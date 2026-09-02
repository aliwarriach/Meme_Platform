import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  approveJoinRequestRequest,
  createCommunityRequest,
  getCommunitiesRequest,
  getCommunityRequest,
  getInvitedCommunitiesRequest,
  getJoinRequestsRequest,
  getMembersRequest,
  getMyCommunitiesRequest,
  inviteToCommunityRequest,
  joinCommunityRequest,
  leaveCommunityRequest,
  rejectJoinRequestRequest,
  updateCommunityBannerRequest,
  updateCommunityIconRequest,
  type CommunityPageResponse,
  type CommunityPrivacy,
  type CommunityResponse,
  type MembershipResponse,
  type UpdateCommunityBannerPayload,
  type UpdateCommunityIconPayload,
} from '@/services/communities';

const discoverKey = (query: string) => ['communities', 'discover', query] as const;
const mineKey = ['communities', 'mine'] as const;
const invitedKey = ['communities', 'invited'] as const;
const communityKey = (communityId: string) => ['communities', communityId] as const;
const membersKey = (communityId: string) => ['communities', communityId, 'members'] as const;
const joinRequestsKey = (communityId: string) =>
  ['communities', communityId, 'join-requests'] as const;

function invalidateCommunityLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['communities', 'discover'] });
  queryClient.invalidateQueries({ queryKey: mineKey });
  queryClient.invalidateQueries({ queryKey: invitedKey });
}

export function useDiscoverCommunities(query = '') {
  const key = discoverKey(query);
  return useInfiniteQuery<
    CommunityPageResponse,
    Error,
    InfiniteData<CommunityPageResponse>,
    typeof key,
    string | undefined
  >({
    queryKey: key,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getCommunitiesRequest({ cursor: pageParam, limit: 20, q: query || undefined });
      if (!response.ok || !response.data) throwApiError(response, 'load communities');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useMyCommunities() {
  return useQuery<CommunityResponse[], Error>({
    queryKey: mineKey,
    queryFn: async () => {
      const response = await getMyCommunitiesRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load your communities');
      return response.data;
    },
  });
}

/** Communities that invited the viewer and haven't been accepted/declined yet — the
 * "Pending" tab on the communities list screen. */
export function useInvitedCommunities() {
  return useQuery<CommunityResponse[], Error>({
    queryKey: invitedKey,
    queryFn: async () => {
      const response = await getInvitedCommunitiesRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load invited communities');
      return response.data;
    },
  });
}

export function useCommunity(communityId: string) {
  return useQuery<CommunityResponse, Error>({
    queryKey: communityKey(communityId),
    queryFn: async () => {
      const response = await getCommunityRequest(communityId);
      if (!response.ok || !response.data) throwApiError(response, 'load community');
      return response.data;
    },
  });
}

export function useCreateCommunityMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    CommunityResponse,
    Error,
    {
      name: string;
      description?: string;
      privacy: CommunityPrivacy;
      icon?: { uri: string; name: string; type: string };
      banner?: { uri: string; name: string; type: string };
    }
  >({
    mutationFn: async (payload) => {
      const response = await createCommunityRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'create community');
      return response.data;
    },
    onSuccess: () => invalidateCommunityLists(queryClient),
  });
}

export function useUpdateCommunityIconMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<CommunityResponse, Error, UpdateCommunityIconPayload>({
    mutationFn: async (payload) => {
      const response = await updateCommunityIconRequest(communityId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'update community icon');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKey(communityId) });
      invalidateCommunityLists(queryClient);
    },
  });
}

export function useUpdateCommunityBannerMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<CommunityResponse, Error, UpdateCommunityBannerPayload>({
    mutationFn: async (payload) => {
      const response = await updateCommunityBannerRequest(communityId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'update community banner');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKey(communityId) });
      invalidateCommunityLists(queryClient);
    },
  });
}

export function useInviteToCommunityMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<MembershipResponse, Error, string>({
    mutationFn: async (username) => {
      const response = await inviteToCommunityRequest(communityId, username);
      if (!response.ok || !response.data) throwApiError(response, 'invite to community');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(communityId) });
    },
  });
}

export function useJoinCommunityMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<MembershipResponse, Error, void>({
    mutationFn: async () => {
      const response = await joinCommunityRequest(communityId);
      if (!response.ok || !response.data) throwApiError(response, 'join community');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKey(communityId) });
      invalidateCommunityLists(queryClient);
    },
  });
}

export function useLeaveCommunityMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await leaveCommunityRequest(communityId);
      if (!response.ok) throwApiError(response, 'leave community');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKey(communityId) });
      queryClient.invalidateQueries({ queryKey: membersKey(communityId) });
      invalidateCommunityLists(queryClient);
    },
  });
}

export function useMembers(communityId: string) {
  return useQuery<MembershipResponse[], Error>({
    queryKey: membersKey(communityId),
    queryFn: async () => {
      const response = await getMembersRequest(communityId);
      if (!response.ok || !response.data) throwApiError(response, 'load members');
      return response.data;
    },
  });
}

export function useJoinRequests(communityId: string, enabled: boolean) {
  return useQuery<MembershipResponse[], Error>({
    queryKey: joinRequestsKey(communityId),
    queryFn: async () => {
      const response = await getJoinRequestsRequest(communityId);
      if (!response.ok || !response.data) throwApiError(response, 'load join requests');
      return response.data;
    },
    enabled,
  });
}

export function useApproveJoinRequestMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<MembershipResponse, Error, string>({
    mutationFn: async (membershipId) => {
      const response = await approveJoinRequestRequest(communityId, membershipId);
      if (!response.ok || !response.data) throwApiError(response, 'approve join request');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestsKey(communityId) });
      queryClient.invalidateQueries({ queryKey: membersKey(communityId) });
      queryClient.invalidateQueries({ queryKey: communityKey(communityId) });
    },
  });
}

export function useRejectJoinRequestMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (membershipId) => {
      const response = await rejectJoinRequestRequest(communityId, membershipId);
      if (!response.ok) throwApiError(response, 'reject join request');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: joinRequestsKey(communityId) }),
  });
}
