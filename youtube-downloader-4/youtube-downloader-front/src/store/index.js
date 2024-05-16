import { configureStore } from '@reduxjs/toolkit';
import jobsReducer from './jobsSlice';

export const store = configureStore({
  reducer: {
    jobs: jobsReducer,
  },
});
