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
  reaction_count: number;
  comment_count: number;
  viewer_has_reacted: boolean;
  created_at: string;
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

export function addContainerReactionRequest(containerId: string) {
  return api.post(`/instagram/containers/${containerId}/reactions`);
}

export function removeContainerReactionRequest(containerId: string) {
  return api.delete(`/instagram/containers/${containerId}/reactions`);
}

export function listContainerCommentsRequest(containerId: string) {
  return api.get<ContainerCommentResponse[]>(`/instagram/containers/${containerId}/comments`);
}

export function addContainerCommentRequest(containerId: string, body: string) {
  return api.post<ContainerCommentResponse>(`/instagram/containers/${containerId}/comments`, {
    body,
  });
}
