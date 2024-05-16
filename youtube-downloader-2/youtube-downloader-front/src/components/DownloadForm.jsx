import React, { useState } from 'react';
import axios from 'axios';

export default function DownloadForm() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [timeoutId, setTimeoutId] = useState(null);

    const clearMessage = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const refreshRate = import.meta.env.VITE_VITE_REFRESH_RATE_MS || '3000';
        const timeToClearMessage = parseInt(refreshRate) * 2;

        setLoading(true);
        clearMessage();
        try {
            await axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/download`, { url });
            setMessage('Download started successfully!');

            setUrl('');

            const id = setTimeout(clearMessage, timeToClearMessage);
            setTimeoutId(id);
        } catch (error) {
            setMessage('Error: Failed to start download');
            console.error('Failed to start download', error);

            const id = setTimeout(clearMessage, timeToClearMessage);
            setTimeoutId(id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mb-3">
            <div className="input-group">
                <input type="text" className="form-control" placeholder="Enter YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} />
                <button className="btn btn-outline-secondary" type="submit" disabled={loading}>
                    {loading ? 'Loading...' : 'Download'}
                </button>
            </div>
            {message && (
                <div className="alert alert-info alert-dismissible fade show mt-2" role="alert">
                    {message}
                    <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close" onClick={clearMessage}></button>
                </div>
            )}
        </form>
    );
}
