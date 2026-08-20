import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import { appendImageToFormData } from '@/utils/multipartImage';

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
  const form = new FormData();
  await appendImageToFormData(form, 'image', {
    uri: payload.imageUri,
    name: payload.imageName,
    type: payload.imageType,
  });
  form.append('name', payload.name);
  if (payload.communityId) form.append('community_id', payload.communityId);

  return api.post<TemplateResponse>('/templates', form, {
    headers: { 'Content-Type': undefined },
  });
}
