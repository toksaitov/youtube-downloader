import React from 'react';

export default function JobListItem({ job }) {
    return (
        <li className="list-group-item">
            <div>
                <strong>{job.url}</strong>: {job.status} {job.status === 'finished' && <span>(<a href={`${import.meta.env.VITE_WORKER_SERVICE_URL}${job.downloadPath}`}>download</a>)</span>}
            </div>
        </li>
    );
}
