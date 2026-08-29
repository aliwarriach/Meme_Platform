import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import type { MemeContainerResponse } from '@/services/instagram';
import { uploadImageDirect } from '@/services/media';

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

// Hot-ranked, offset-paginated (as opposed to `FeedPageResponse`'s keyset `next_cursor`) —
// backs the tag screen's Hot tab (Roadmap_Search.md S5) via `GET /hashtags/{slug}/memes/hot`.
export interface HotFeedPageResponse {
  items: MemeResponse[];
  has_more: boolean;
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

// Author-only — backs the edit screen. `editor_document` is the creator's serializable
// layer document (features/creator/document.ts's MemeDocument), stored opaquely by the
// backend; null for a meme published before that column existed.
export interface MemeEditDataResponse {
  id: string;
  image_url: string;
  caption: string | null;
  hashtags: string[];
  editor_document: Record<string, unknown> | null;
}

export function getFeedRequest(params: { offset?: number; limit?: number }) {
  return api.get<MergedFeedPageResponse>('/memes/feed', params);
}

export function getMemeRequest(memeId: string) {
  return api.get<MemeResponse>(`/memes/${memeId}`);
}

export async function createMemeRequest(payload: {
  imageUri: string;
  imageName: string;
  imageType: string;
  caption?: string;
  audiences: AudienceType[];
  // Personal posts only — community posts don't accept tags yet (backend scope limit).
  hashtags?: string[];
  // The creator's layer document (already resolved to stable URLs — see
  // features/creator/persistDocument.ts), JSON-stringified. Optional so a caller with no
  // document (shouldn't normally happen for this screen, but keeps the field non-mandatory
  // for any other future caller) can omit it.
  editorDocumentJson?: string;
}) {
  // Roadmap_Scaling.md A4 — image bytes go straight to Cloudinary; only the confirmed
  // public_id is sent to our own backend.
  const imagePublicId = await uploadImageDirect(
    { uri: payload.imageUri, name: payload.imageName, type: payload.imageType },
    'memes'
  );

  const form = new FormData();
  form.append('image_public_id', imagePublicId);
  if (payload.caption) form.append('caption', payload.caption);
  payload.audiences.forEach((audience) => form.append('audiences', audience));
  payload.hashtags?.forEach((tag) => form.append('hashtags', tag));
  if (payload.editorDocumentJson) form.append('editor_document_json', payload.editorDocumentJson);

  // apisauce defaults every request to Content-Type: application/json, which makes
  // axios JSON-stringify the FormData instead of sending it as multipart. Clearing
  // it here lets the browser/native layer set the correct multipart boundary itself.
  return api.post<MemeResponse>('/memes', form, { headers: { 'Content-Type': undefined } });
}

// Author-only edit — photo/caption/tags/text-overlay only (audience, community, and any
// challenge association never change after publish). Every field is optional; omit a
// field to leave it untouched. `hashtags: []` clears every tag (distinct from omitting
// `hashtags` entirely, which leaves them as-is) — see the backend's `hashtags_provided`
// contract this maps onto.
export async function updateMemeRequest(
  memeId: string,
  payload: {
    caption?: string | null;
    hashtags?: string[];
    image?: { uri: string; name: string; type: string };
    editorDocumentJson?: string;
  }
) {
  const form = new FormData();
  if (payload.caption !== undefined) form.append('caption', payload.caption ?? '');
  if (payload.hashtags !== undefined) {
    form.append('hashtags_provided', 'true');
    payload.hashtags.forEach((tag) => form.append('hashtags', tag));
  }
  if (payload.image) {
    const imagePublicId = await uploadImageDirect(payload.image, 'memes');
    form.append('image_public_id', imagePublicId);
  }
  if (payload.editorDocumentJson) form.append('editor_document_json', payload.editorDocumentJson);

  return api.patch<MemeResponse>(`/memes/${memeId}`, form, {
    headers: { 'Content-Type': undefined },
  });
}

export function getMemeEditDataRequest(memeId: string) {
  return api.get<MemeEditDataResponse>(`/memes/${memeId}/edit`);
}

export function deleteMemeRequest(memeId: string) {
  return api.delete(`/memes/${memeId}`);
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
  editorDocumentJson?: string;
}) {
  // Roadmap_Scaling.md A4 — image bytes go straight to Cloudinary; only the confirmed
  // public_id is sent to our own backend. Mirrors createMemeRequest above — this call site
  // used to send the raw image Blob through axios instead, which is what threw "Unsupported
  // FormData implementation" on some RN/axios combinations.
  const imagePublicId = await uploadImageDirect(
    { uri: payload.imageUri, name: payload.imageName, type: payload.imageType },
    'memes'
  );

  const form = new FormData();
  form.append('image_public_id', imagePublicId);
  if (payload.caption) form.append('caption', payload.caption);
  if (payload.editorDocumentJson) form.append('editor_document_json', payload.editorDocumentJson);

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
