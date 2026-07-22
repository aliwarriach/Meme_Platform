import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

interface SocketState {
  status: SocketStatus;
}

const initialState: SocketState = {
  status: 'disconnected',
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setSocketStatus(state, action: PayloadAction<SocketStatus>) {
      state.status = action.payload;
    },
  },
});

export const { setSocketStatus } = socketSlice.actions;
export default socketSlice.reducer;
