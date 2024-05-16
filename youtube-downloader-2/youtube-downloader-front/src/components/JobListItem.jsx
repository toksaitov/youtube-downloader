import React from 'react';

export default function JobListItem({ job }) {
    return (
        <li className="list-group-item">
            <div>
                <strong>{job.url}</strong> - {job.status} {job.status === 'finished' && <a href={`${import.meta.env.VITE_PUBLIC_API_URL}${job.downloadPath}`}>download</a>}
            </div>
        </li>
    );
}
