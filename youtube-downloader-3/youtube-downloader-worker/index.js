import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import amqplib from 'amqplib';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 2020;
const STATUS_SERVICE_URL = process.env.STATUS_SERVICE_URL || 'redis://localhost:6379';
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'amqp://localhost';
const QUEUE_SERVICE_JOB_QUEUE = process.env.QUEUE_SERVICE_JOB_QUEUE || 'video_download_queue';

const downloadsDir = path.join('public', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  console.log(`Created directory at '${downloadsDir}'`);
}

const redisClient = createClient({
  url: STATUS_SERVICE_URL
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
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
      retryCount++;
    }
  }
}
connectToRedis();

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
                await redisClient.hSet(jobId, { status: 'finished', downloadPath: `:${PORT}/downloads/${jobId}.mp4` });
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
app.use(express.static('public'));
app.listen(PORT, () => {
  console.log(`The YouTube Downloader Worker is running on port '${PORT}'.`);
});
