import { api } from '@/services/api';
import type { MemeResponse } from '@/services/memes';
import type { PublicUserResponse } from '@/services/auth';

/**
 * The feed's "↗ Send" shortcut. Backed by a shim that posts the meme into the real
 * conversation with that friend (`/messaging`), so anything sent here shows up in the
 * thread — see `backend/app/services/meme_sending.py`.
 */

export type MemeSendStatus = 'delivered' | 'pending';

export interface MemeSendResponse {
  id: string;
  sender: PublicUserResponse;
  recipient: PublicUserResponse;
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
