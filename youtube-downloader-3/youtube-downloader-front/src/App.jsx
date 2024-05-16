import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import DownloadForm from './components/DownloadForm';
import JobList from './components/JobList';

function App() {
  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">YouTube Video Downloader</h1>
      <DownloadForm />
      <JobList />
    </div>
  );
}

export default App;
