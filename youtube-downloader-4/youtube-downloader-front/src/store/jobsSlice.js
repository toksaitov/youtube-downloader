import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchJobs = createAsyncThunk('jobs/fetchJobs', async () => {
    const response = await axios.get(`${import.meta.env.VITE_API_SERVICE_URL}/api/v1/status`);
    return response.data;
});

const jobsSlice = createSlice({
    name: 'jobs',
    initialState: {
        jobs: [],
        status: 'idle',
        error: null
    },
    reducers: {},
    extraReducers: builder => {
        builder
        .addCase(fetchJobs.pending, state => {
            state.status = 'loading';
        })
        .addCase(fetchJobs.fulfilled, (state, action) => {
            state.status = 'succeeded';
            state.jobs = action.payload;
        })
        .addCase(fetchJobs.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.error.message;
        });
    }
});

export default jobsSlice.reducer;
