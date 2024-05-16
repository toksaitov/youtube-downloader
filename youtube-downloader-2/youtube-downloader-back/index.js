import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 2929;

const downloadsDir = path.join('public', 'downloads');
if (!fs.existsSync(downloadsDir)){
    fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const jobs = {};

app.post('/api/v1/download', async (req, res) => {
    const url = req.body.url;
    const jobId = uuidv4();

    if (!ytdl.validateURL(url)) {
        jobs[jobId] = { id: jobId, status: 'failed', reason: 'Invalid URL', timestamp: new Date().toISOString() };
        return res.status(400).json(jobs[jobId]);
    }

    jobs[jobId] = { id: jobId, status: 'queued', url, timestamp: new Date().toISOString() };
    ytdl(url)
        .pipe(fs.createWriteStream(path.join(downloadsDir, `${jobId}.mp4`)))
        .on('finish', () => {
            jobs[jobId].status = 'finished';
            jobs[jobId].downloadPath = `/downloads/${jobId}.mp4`;
        })
        .on('error', error => {
            jobs[jobId].status = 'failed';
            jobs[jobId].reason = error.message;
        });

    res.json(jobs[jobId]);
});

app.get('/api/v1/status', (req, res) => {
    const jobId = req.query.jobId;
    if (jobId) {
        if (!jobs[jobId]) {
            return res.status(404).send({});
        }
        res.json(jobs[jobId]);
    } else {
        const jobsArray = Object.values(jobs).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(jobsArray);
    }
});

app.listen(PORT, () => {
    console.log(`The YouTube Downloader is running on port '${PORT}'.`);
});
