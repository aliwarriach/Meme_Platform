import { api } from '@/services/api';
import type { AuthUserResponse } from '@/services/auth';
import type { MemeResponse } from '@/services/memes';

export type MessageKind = 'text' | 'meme';

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender: AuthUserResponse;
  kind: MessageKind;
  body: string | null;
  /** Null for text messages, and for a meme message whose meme was deleted since. */
  meme: MemeResponse | null;
  read_at: string | null;
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  other_user: AuthUserResponse;
  last_message: MessageResponse | null;
  unread_count: number;
  last_message_at: string | null;
}

export interface MessagePageResponse {
  items: MessageResponse[];
  next_cursor: string | null;
}

export interface ConversationReadResponse {
  conversation_id: string;
  read_count: number;
  read_at: string | null;
}

export type SendMessagePayload =
  | { kind: 'text'; body: string }
  | { kind: 'meme'; meme_id: string };

export function listConversationsRequest() {
  return api.get<ConversationResponse[]>('/messaging/conversations');
}

export function openConversationRequest(userId: string) {
  return api.post<ConversationResponse>('/messaging/conversations', { user_id: userId });
}

export function listMessagesRequest(conversationId: string, cursor: string | null, limit = 30) {
  return api.get<MessagePageResponse>(`/messaging/conversations/${conversationId}/messages`, {
    limit,
    ...(cursor ? { cursor } : {}),
  });
}

export function sendMessageRequest(conversationId: string, payload: SendMessagePayload) {
  return api.post<MessageResponse>(
    `/messaging/conversations/${conversationId}/messages`,
    payload
  );
}

export function markConversationReadRequest(conversationId: string) {
  return api.post<ConversationReadResponse>(`/messaging/conversations/${conversationId}/read`);
}
