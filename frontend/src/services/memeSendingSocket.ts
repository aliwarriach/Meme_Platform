import { API_BASE_URL } from '@/constants/config';
import type { AppDispatch } from '@/store/store';
import { setSocketStatus } from '@/store/socketSlice';
import type { MemeSendResponse } from '@/services/memeSending';

type IncomingMessage =
  | { type: 'meme_received'; send: MemeSendResponse }
  | { type: 'meme_send_reaction'; send: MemeSendResponse };

type Listener = (message: IncomingMessage) => void;

// Single ad hoc WebSocket connection for the whole app, matching frontend/CLAUDE.md's
// "never open ad hoc sockets per screen" rule — screens subscribe via `onMessage`
// instead of opening their own connection.
let socket: WebSocket | null = null;
let listeners: Listener[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// Guards against a stale socket's async onclose (browser close events fire on a later
// tick, not synchronously) scheduling a reconnect after an intentional disconnect —
// without this, calling disconnectMemeSendingSocket() (logout, or a stale effect
// cleanup) could still leave a reconnect timer alive using the old token.
let intentionalDisconnect = false;

function wsUrl(token: string): string {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/meme-sending/ws?token=${encodeURIComponent(token)}`;
}

export function connectMemeSendingSocket(token: string, dispatch: AppDispatch): void {
  if (socket) return;

  intentionalDisconnect = false;
  dispatch(setSocketStatus('connecting'));
  const ws = new WebSocket(wsUrl(token));
  socket = ws;

  ws.onopen = () => {
    dispatch(setSocketStatus('connected'));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as IncomingMessage;
      listeners.forEach((listener) => listener(message));
    } catch {
      // Ignore malformed frames rather than crashing the socket handler.
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (intentionalDisconnect) return;

    dispatch(setSocketStatus('disconnected'));
    // Reconnect for realistic drop causes (backgrounding, brief network loss) — not on
    // an auth rejection, since token won't have changed and it would just loop.
    reconnectTimer = setTimeout(() => connectMemeSendingSocket(token, dispatch), 3000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function disconnectMemeSendingSocket(): void {
  intentionalDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  listeners = [];
  socket?.close();
  socket = null;
}

export function onMemeSendingMessage(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
