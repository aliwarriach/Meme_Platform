import { API_BASE_URL } from '@/constants/config';
import { api } from '@/services/api';
import type { AppDispatch } from '@/store/store';
import { setSocketStatus } from '@/store/socketSlice';
import type { MessageResponse } from '@/services/messaging';
import type { NotificationResponse } from '@/services/notifications';

export type IncomingMessage =
  | { type: 'message_received'; conversation_id: string; message: MessageResponse }
  | { type: 'message_read'; conversation_id: string; reader_id: string; read_at: string }
  | { type: 'notification'; notification: NotificationResponse };

type Listener = (message: IncomingMessage) => void;

// Single ad hoc WebSocket connection for the whole app, matching frontend/CLAUDE.md's
// "never open ad hoc sockets per screen" rule — screens subscribe via `onMessage`
// instead of opening their own connection.
//
// The URL still says /meme-sending because that's where the backend's single per-user
// socket lives; since Phase 19 it carries conversation frames rather than meme sends.
let socket: WebSocket | null = null;
let listeners: Listener[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// Guards against a stale socket's async onclose (browser close events fire on a later
// tick, not synchronously) scheduling a reconnect after an intentional disconnect —
// without this, calling disconnectMemeSendingSocket() (logout, or a stale effect
// cleanup) could still leave a reconnect timer alive using the old token.
let intentionalDisconnect = false;
// Guards against a reconnect timer firing while a connect attempt is still awaiting its
// ticket, which would otherwise fetch a second ticket and open a duplicate socket.
let connecting = false;

function wsUrl(ticket: string): string {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/meme-sending/ws?ticket=${encodeURIComponent(ticket)}`;
}

function scheduleReconnect(token: string, dispatch: AppDispatch): void {
  if (intentionalDisconnect) return;
  dispatch(setSocketStatus('disconnected'));
  // Reconnect for realistic drop causes (backgrounding, brief network loss) — not on
  // an auth rejection, since the token won't have changed and it would just loop.
  reconnectTimer = setTimeout(() => connectMemeSendingSocket(token, dispatch), 3000);
}

export async function connectMemeSendingSocket(token: string, dispatch: AppDispatch): Promise<void> {
  if (socket || connecting) return;

  connecting = true;
  intentionalDisconnect = false;
  dispatch(setSocketStatus('connecting'));

  // Exchange the session JWT (sent as a normal Bearer-authenticated request) for a
  // short-lived, single-use ticket, so the long-lived token itself never travels in the
  // socket URL — see backend/app/routers/meme_sending.py's `/ws-ticket` endpoint.
  const response = await api.post<{ ticket: string }>('/meme-sending/ws-ticket');
  connecting = false;

  if (intentionalDisconnect) return;
  if (!response.ok || !response.data) {
    scheduleReconnect(token, dispatch);
    return;
  }

  const ws = new WebSocket(wsUrl(response.data.ticket));
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
    scheduleReconnect(token, dispatch);
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
