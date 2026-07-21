import { api } from '@/services/api';
import type { AuthUserResponse } from '@/services/auth';
import { appendImageToFormData } from '@/utils/multipartImage';

export type AudienceType = 'public' | 'friends';

export interface MemeResponse {
  id: string;
  author: AuthUserResponse;
  image_url: string;
  caption: string | null;
  audiences: AudienceType[];
  reaction_count: number;
  comment_count: number;
  viewer_has_reacted: boolean;
  created_at: string;
}

export interface FeedPageResponse {
  items: MemeResponse[];
  next_cursor: string | null;
}

export interface CommentResponse {
  id: string;
  author: AuthUserResponse;
  body: string;
  created_at: string;
}

export function getFeedRequest(params: { cursor?: string; limit?: number }) {
  return api.get<FeedPageResponse>('/memes/feed', params);
}

export async function createMemeRequest(payload: {
  imageUri: string;
  imageName: string;
  imageType: string;
  caption?: string;
  audiences: AudienceType[];
}) {
  const form = new FormData();
  await appendImageToFormData(form, 'image', {
    uri: payload.imageUri,
    name: payload.imageName,
    type: payload.imageType,
  });

  if (payload.caption) form.append('caption', payload.caption);
  payload.audiences.forEach((audience) => form.append('audiences', audience));

  // apisauce defaults every request to Content-Type: application/json, which makes
  // axios JSON-stringify the FormData instead of sending it as multipart. Clearing
  // it here lets the browser/native layer set the correct multipart boundary itself.
  return api.post<MemeResponse>('/memes', form, { headers: { 'Content-Type': undefined } });
}

export function addReactionRequest(memeId: string) {
  return api.post(`/memes/${memeId}/reactions`);
}

export function removeReactionRequest(memeId: string) {
  return api.delete(`/memes/${memeId}/reactions`);
}

export function addCommentRequest(memeId: string, body: string) {
  return api.post<CommentResponse>(`/memes/${memeId}/comments`, { body });
}

export function listCommentsRequest(memeId: string) {
  return api.get<CommentResponse[]>(`/memes/${memeId}/comments`);
}
