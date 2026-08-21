import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/store/authSlice';
import creatorDraftReducer from '@/store/creatorDraftSlice';
import socketReducer from '@/store/socketSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    socket: socketReducer,
    creatorDraft: creatorDraftReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
