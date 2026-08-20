import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import { appendImageToFormData } from '@/utils/multipartImage';

export type CommunityPrivacy = 'open' | 'invite_only';
export type MembershipRole = 'owner' | 'member';
export type MembershipStatus = 'pending' | 'active';

export interface CommunityResponse {
  id: string;
  owner: PublicUserResponse;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  privacy: CommunityPrivacy;
  member_count: number;
  viewer_membership_status: MembershipStatus | null;
  has_active_challenge: boolean;
  created_at: string;
}

export interface CommunityPageResponse {
  items: CommunityResponse[];
  next_cursor: string | null;
}

export interface MembershipResponse {
  id: string;
  user: PublicUserResponse;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
}

export function getCommunitiesRequest(params: { cursor?: string; limit?: number }) {
  return api.get<CommunityPageResponse>('/communities', params);
}

export function getMyCommunitiesRequest() {
  return api.get<CommunityResponse[]>('/communities/mine');
}

export function getCommunityRequest(communityId: string) {
  return api.get<CommunityResponse>(`/communities/${communityId}`);
}

export async function createCommunityRequest(payload: {
  name: string;
  description?: string;
  privacy: CommunityPrivacy;
  icon?: { uri: string; name: string; type: string };
  banner?: { uri: string; name: string; type: string };
}) {
  const form = new FormData();
  form.append('name', payload.name);
  form.append('privacy', payload.privacy);
  if (payload.description) form.append('description', payload.description);
  if (payload.icon) await appendImageToFormData(form, 'icon', payload.icon);
  if (payload.banner) await appendImageToFormData(form, 'banner', payload.banner);

  return api.post<CommunityResponse>('/communities', form, {
    headers: { 'Content-Type': undefined },
  });
}

export function joinCommunityRequest(communityId: string) {
  return api.post<MembershipResponse>(`/communities/${communityId}/join`);
}

export function leaveCommunityRequest(communityId: string) {
  return api.delete(`/communities/${communityId}/membership`);
}

export function getMembersRequest(communityId: string) {
  return api.get<MembershipResponse[]>(`/communities/${communityId}/members`);
}

export function getJoinRequestsRequest(communityId: string) {
  return api.get<MembershipResponse[]>(`/communities/${communityId}/join-requests`);
}

export function approveJoinRequestRequest(communityId: string, membershipId: string) {
  return api.post<MembershipResponse>(
    `/communities/${communityId}/join-requests/${membershipId}/approve`
  );
}

export function rejectJoinRequestRequest(communityId: string, membershipId: string) {
  return api.delete(`/communities/${communityId}/join-requests/${membershipId}`);
}
