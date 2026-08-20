import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import type { MemeContainerResponse } from '@/services/instagram';
import { appendImageToFormData } from '@/utils/multipartImage';

export type AudienceType = 'public' | 'friends';

export interface CommunityBadge {
  id: string;
  name: string;
}

export interface MemeResponse {
  id: string;
  author: PublicUserResponse;
  image_url: string;
  caption: string | null;
  audiences: (AudienceType | 'community')[];
  community: CommunityBadge | null;
  upvote_count: number;
  downvote_count: number;
  score: number;
  comment_count: number;
  // Private engagement data — null unless the viewer is authorized (the meme's author, or
  // a community post's community owner). See backend services/memes.py::build_meme_out.
  view_count: number | null;
  viewer_vote: 1 | -1 | null;
  created_at: string;
}

export interface FeedPageResponse {
  items: MemeResponse[];
  next_cursor: string | null;
}

// The public feed merges native memes with externally-shared MemeContainers (Instagram
// Companion Mode) into one tagged-union list — see backend services/instagram.py::get_merged_feed.
// Community feeds stay memes-only (FeedPageResponse above), since containers aren't
// community-scoped.
export type MergedFeedItem =
  | { kind: 'meme'; meme: MemeResponse }
  | { kind: 'container'; container: MemeContainerResponse };

export interface MergedFeedPageResponse {
  items: MergedFeedItem[];
  has_more: boolean;
}

export interface CommentResponse {
  id: string;
  author: PublicUserResponse;
  body: string;
  created_at: string;
}

export function getFeedRequest(params: { offset?: number; limit?: number }) {
  return api.get<MergedFeedPageResponse>('/memes/feed', params);
}

export async function createMemeRequest(payload: {
  imageUri: string;
  imageName: string;
  imageType: string;
  caption?: string;
  audiences: AudienceType[];
  // Personal posts only — community posts don't accept tags yet (backend scope limit).
  hashtags?: string[];
}) {
  const form = new FormData();
  await appendImageToFormData(form, 'image', {
    uri: payload.imageUri,
    name: payload.imageName,
    type: payload.imageType,
  });

  if (payload.caption) form.append('caption', payload.caption);
  payload.audiences.forEach((audience) => form.append('audiences', audience));
  payload.hashtags?.forEach((tag) => form.append('hashtags', tag));

  // apisauce defaults every request to Content-Type: application/json, which makes
  // axios JSON-stringify the FormData instead of sending it as multipart. Clearing
  // it here lets the browser/native layer set the correct multipart boundary itself.
  return api.post<MemeResponse>('/memes', form, { headers: { 'Content-Type': undefined } });
}

// Community posts are created from inside the community — no client-chosen audience.
// Visibility (community-only vs. also-public) is derived server-side from the
// community's privacy setting.
export async function createCommunityMemeRequest(payload: {
  communityId: string;
  imageUri: string;
  imageName: string;
  imageType: string;
  caption?: string;
}) {
  const form = new FormData();
  await appendImageToFormData(form, 'image', {
    uri: payload.imageUri,
    name: payload.imageName,
    type: payload.imageType,
  });

  if (payload.caption) form.append('caption', payload.caption);

  return api.post<MemeResponse>(`/communities/${payload.communityId}/memes`, form, {
    headers: { 'Content-Type': undefined },
  });
}

export function getCommunityFeedRequest(
  communityId: string,
  params: { cursor?: string; limit?: number }
) {
  return api.get<FeedPageResponse>(`/communities/${communityId}/feed`, params);
}

export interface VoteResponse {
  meme_id: string;
  upvote_count: number;
  downvote_count: number;
  score: number;
  viewer_vote: 1 | -1 | null;
}

export function castVoteRequest(memeId: string, value: 1 | -1) {
  return api.post<VoteResponse>(`/memes/${memeId}/votes`, { value });
}

export interface MemeViewResponse {
  meme_id: string;
  view_count: number;
}

// Records one impression — the reach signal behind a meme's MemeScore. Fire-and-forget
// from the UI's side (see useRecordMemeViewMutation); the backend dedups per (meme, user),
// so calling this repeatedly for the same viewer is harmless/idempotent.
export function recordMemeViewRequest(memeId: string) {
  return api.post<MemeViewResponse>(`/memes/${memeId}/views`);
}

export function addCommentRequest(memeId: string, body: string) {
  return api.post<CommentResponse>(`/memes/${memeId}/comments`, { body });
}

export function listCommentsRequest(memeId: string) {
  return api.get<CommentResponse[]>(`/memes/${memeId}/comments`);
}
