import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchJobs } from '../store/jobsSlice';
import JobListItem from './JobListItem';

export default function JobList() {
    const dispatch = useDispatch();
    const jobs = useSelector(state => state.jobs.jobs);
    const jobStatus = useSelector(state => state.jobs.status);

    const refreshRate = import.meta.env.VITE_REFRESH_RATE_MS || '3000';
    const timeToRefresh = parseInt(refreshRate);

    useEffect(() => {
        dispatch(fetchJobs());
        const interval = setInterval(() => {
            dispatch(fetchJobs());
        }, timeToRefresh);

        return () => clearInterval(interval);
    }, [dispatch]);

    return (
        <div>
        {jobStatus === 'failed' ? (
            <div className="alert alert-danger mt-2">{message}</div>
        ) : (
            <ul className="list-group">
                {jobs.map(job => (
                    <JobListItem key={job.id} job={job} />
                ))}
            </ul>
        )}
        </div>
    );
}
