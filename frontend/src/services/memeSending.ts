import { api } from '@/services/api';
import type { MemeResponse } from '@/services/memes';
import type { AuthUserResponse } from '@/services/auth';

export type MemeSendStatus = 'delivered' | 'pending' | 'seen';

export interface MemeSendResponse {
  id: string;
  sender: AuthUserResponse;
  recipient: AuthUserResponse;
  meme: MemeResponse;
  status: MemeSendStatus;
  reaction: string | null;
  created_at: string;
}

export function sendMemeRequest(payload: { recipientId: string; memeId: string }) {
  return api.post<MemeSendResponse>('/meme-sending/send', {
    recipient_id: payload.recipientId,
    meme_id: payload.memeId,
  });
}

export function getInboxRequest() {
  return api.get<MemeSendResponse[]>('/meme-sending/inbox');
}

export function getSentRequest() {
  return api.get<MemeSendResponse[]>('/meme-sending/sent');
}

export function acknowledgeSendRequest(sendId: string) {
  return api.post<MemeSendResponse>(`/meme-sending/inbox/${sendId}/seen`);
}

export function reactToSendRequest(sendId: string, reaction: string) {
  return api.post<MemeSendResponse>(`/meme-sending/inbox/${sendId}/react`, { reaction });
}
