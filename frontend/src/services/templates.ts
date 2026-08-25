import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import { uploadImageDirect } from '@/services/media';

export interface TemplateResponse {
  id: string;
  uploader: PublicUserResponse;
  community_id: string | null;
  name: string;
  image_url: string;
  created_at: string;
}

export interface TemplatePageResponse {
  items: TemplateResponse[];
  next_cursor: string | null;
}

export function getTemplatesRequest(params: { cursor?: string; limit?: number }) {
  return api.get<TemplatePageResponse>('/templates', params);
}

export function getCommunityTemplatesRequest(
  communityId: string,
  params: { cursor?: string; limit?: number }
) {
  return api.get<TemplatePageResponse>(`/communities/${communityId}/templates`, params);
}

export async function createTemplateRequest(payload: {
  imageUri: string;
  imageName: string;
  imageType: string;
  name: string;
  communityId?: string;
}) {
  // Roadmap_Scaling.md A4 — image bytes go straight to Cloudinary; only the confirmed
  // public_id is sent to our own backend.
  const imagePublicId = await uploadImageDirect(
    { uri: payload.imageUri, name: payload.imageName, type: payload.imageType },
    'templates'
  );

  const form = new FormData();
  form.append('image_public_id', imagePublicId);
  form.append('name', payload.name);
  if (payload.communityId) form.append('community_id', payload.communityId);

  return api.post<TemplateResponse>('/templates', form, {
    headers: { 'Content-Type': undefined },
  });
}
