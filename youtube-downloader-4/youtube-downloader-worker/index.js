import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import amqplib from 'amqplib';
import ytdl from 'ytdl-core';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 2020;
const STATUS_SERVICE_URL = process.env.STATUS_SERVICE_URL || 'redis://localhost:6379';
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'amqp://localhost';
const QUEUE_SERVICE_JOB_QUEUE = process.env.QUEUE_SERVICE_JOB_QUEUE || 'video_download_queue';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
if (!AWS_ACCESS_KEY_ID) {
    throw new Error('The environment variable \'AWS_ACCESS_KEY_ID\' is required but was not specified.');
}
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
if (!AWS_SECRET_ACCESS_KEY) {
    throw new Error('The environment variable \'AWS_SECRET_ACCESS_KEY\' is required but was not specified.');
}
const AWS_REGION = process.env.AWS_REGION;
if (!AWS_REGION) {
    throw new Error('The environment variable \'AWS_REGION\' is required but was not specified.');
}
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!S3_BUCKET_NAME) {
    throw new Error('The environment variable \'S3_BUCKET_NAME\' is required but was not specified.');
}

const downloadsDir = path.join('public', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  console.log(`Created directory at '${downloadsDir}'`);
}

const redisClient = createClient({
  url: STATUS_SERVICE_URL
});

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION
});

async function connectToRedis() {
  let retryCount = 0;
  while (true) {
    try {
      await redisClient.connect();
      console.log('Connected to Redis successfully');
      break;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      await redisClient.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
      retryCount++;
    }
  }
}
connectToRedis();

async function uploadFileToS3(filePath, jobId) {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: S3_BUCKET_NAME,
    Key: `${jobId}.mp4`,
    Body: fileContent
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${data.Location}`);
    return data.Location;
  } catch (error) {
    console.error("Error uploading data: ", error);
    throw error;
  }
}

async function connectRabbitMQAndConsume() {
  let retryCount = 0;
  while (true) {
    try {
      const connection = await amqplib.connect(QUEUE_SERVICE_URL);
      console.log('Connected to RabbitMQ successfully');
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_SERVICE_JOB_QUEUE);
      console.log(`Queue '${QUEUE_SERVICE_JOB_QUEUE}' is ready`);

      channel.consume(QUEUE_SERVICE_JOB_QUEUE, async (msg) => {
        if (msg !== null) {
          const { jobId, url } = JSON.parse(msg.content.toString());
          console.log(`Processing job: '${jobId}' for URL: '${url}'`);
          const videoPath = path.join(downloadsDir, `${jobId}.mp4`);
          ytdl(url)
            .pipe(fs.createWriteStream(videoPath))
            .on('finish', async () => {
              console.log(`Video downloaded and saved to '${videoPath}'`);
              try {
                const uploadedUrl = await uploadFileToS3(videoPath, jobId);
                await redisClient.hSet(jobId, { status: 'finished', downloadPath: uploadedUrl });
                console.log(`Video uploaded to S3, and the path '${uploadedUrl}' saved to Redis`);
              } catch (error) {
                console.error(`Error processing video for job '${jobId}':`, error);
                await redisClient.hSet(jobId, { status: 'failed', reason: error.message });
              }
            })
            .on('error', async error => {
              console.error(`Error downloading video for job '${jobId}':`, error);
              await redisClient.hSet(jobId, { status: 'failed', reason: error.message });
            });

          channel.ack(msg);
        }
      });

      return;
    } catch (error) {
      console.error('Failed to connect to RabbitMQ or setup channel:', error);
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
      retryCount++;
    }
  }
}
connectRabbitMQAndConsume();

const app = express();
app.use(cors());
app.use(express.json());
app.listen(PORT, () => {
  console.log(`The YouTube Downloader Worker is running on port '${PORT}'.`);
});
