import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import amqplib from 'amqplib';
import ytdl from 'ytdl-core';

const PORT = process.env.PORT || 1010;
const STATUS_SERVICE_URL = process.env.STATUS_SERVICE_URL || 'redis://localhost:6379';
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'amqp://localhost';
const QUEUE_SERVICE_JOB_QUEUE = process.env.QUEUE_SERVICE_JOB_QUEUE || 'video_download_queue';

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
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      retryCount++;
    }
  }
}
connectToRedis();

async function connectRabbitMQ() {
  let retryCount = 0;
  while (true) {
    try {
      const connection = await amqplib.connect(QUEUE_SERVICE_URL);
      console.log('Connected to RabbitMQ successfully');
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_SERVICE_JOB_QUEUE);
      console.log(`Queue '${QUEUE_SERVICE_JOB_QUEUE}' is ready`);
      return channel;
    } catch (error) {
      console.error('Failed to connect to RabbitMQ or setup channel:', error);
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      retryCount++;
    }
  }
}
const rabbitChannelPromise = connectRabbitMQ();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/v1/download', async (req, res) => {
  const url = req.body.url;
  const jobId = uuidv4();
  console.log(`Received download request for URL: '${url}'`);

  if (!ytdl.validateURL(url)) {
    console.log(`Invalid URL: '${url}'`);
    return res.status(400).end();
  }

  const job = { id: jobId, status: 'queued', url, timestamp: new Date().toISOString() };
  await redisClient.hSet(jobId, job);
  console.log(`Job created with ID: '${jobId}'`);

  const rabbitChannel = await rabbitChannelPromise;
  rabbitChannel.sendToQueue(QUEUE_SERVICE_JOB_QUEUE, Buffer.from(JSON.stringify({ jobId, url })));
  console.log(`Job '${jobId}' sent to RabbitMQ`);

  res.json(job);
});

app.get('/api/v1/status', async (req, res) => {
  const jobId = req.query.jobId;
  if (jobId) {
    const job = await redisClient.hGetAll(jobId);
    if (!job || Object.keys(job).length === 0) {
      console.log(`Job ID '${jobId}' not found`);
      return res.status(404).send({});
    }
    res.json(job);
  } else {
    const keys = await redisClient.keys('*');
    const jobs = await Promise.all(keys.map(key => redisClient.hGetAll(key)));
    const jobsArray = jobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(jobsArray);
  }
});

app.listen(PORT, () => {
  console.log(`The YouTube Downloader API Gateway is running on port '${PORT}'.`);
});
