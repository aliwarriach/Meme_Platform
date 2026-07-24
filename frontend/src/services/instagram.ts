import { api } from '@/services/api';
import type { AuthUserResponse } from '@/services/auth';

export type ContainerMetadataStatus = 'pending' | 'ready' | 'failed';

export interface MemeContainerResponse {
  id: string;
  submitter: AuthUserResponse;
  platform: 'instagram';
  source_url: string;
  title: string | null;
  thumbnail_url: string | null;
  metadata_status: ContainerMetadataStatus;
  upvote_count: number;
  downvote_count: number;
  score: number;
  comment_count: number;
  // Private engagement data — null unless the viewer is the submitter. See backend
  // services/instagram.py::_build_container_out.
  view_count: number | null;
  viewer_vote: 1 | -1 | null;
  created_at: string;
}

export interface ContainerViewResponse {
  meme_container_id: string;
  view_count: number;
}

export interface ContainerCommentResponse {
  id: string;
  author: AuthUserResponse;
  body: string;
  created_at: string;
}

export function createContainerRequest(sourceUrl: string) {
  return api.post<MemeContainerResponse>('/instagram/containers', { source_url: sourceUrl });
}

export function getContainerRequest(containerId: string) {
  return api.get<MemeContainerResponse>(`/instagram/containers/${containerId}`);
}

export function castContainerVoteRequest(containerId: string, value: 1 | -1) {
  return api.post<MemeContainerResponse>(`/instagram/containers/${containerId}/votes`, { value });
}

// Records one impression on a container — reach signal for its MemeScore. Fire-and-forget.
export function recordContainerViewRequest(containerId: string) {
  return api.post<ContainerViewResponse>(`/instagram/containers/${containerId}/views`);
}

export function listContainerCommentsRequest(containerId: string) {
  return api.get<ContainerCommentResponse[]>(`/instagram/containers/${containerId}/comments`);
}

export function addContainerCommentRequest(containerId: string, body: string) {
  return api.post<ContainerCommentResponse>(`/instagram/containers/${containerId}/comments`, {
    body,
  });
}
