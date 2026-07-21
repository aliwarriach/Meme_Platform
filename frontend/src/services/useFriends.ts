import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  acceptFriendRequest,
  listFriendsRequest,
  listIncomingFriendRequestsRequest,
  removeFriendshipRequest,
  sendFriendRequest,
  type FriendResponse,
  type FriendshipResponse,
} from '@/services/friends';

const friendsKey = ['friends'] as const;
const friendRequestsKey = ['friends', 'requests'] as const;

export function useFriendsList() {
  return useQuery<FriendResponse[], Error>({
    queryKey: friendsKey,
    queryFn: async () => {
      const response = await listFriendsRequest();
      if (!response.ok || !response.data) throwApiError(response, 'list friends');
      return response.data;
    },
  });
}

export function useIncomingFriendRequests() {
  return useQuery<FriendshipResponse[], Error>({
    queryKey: friendRequestsKey,
    queryFn: async () => {
      const response = await listIncomingFriendRequestsRequest();
      if (!response.ok || !response.data) throwApiError(response, 'list friend requests');
      return response.data;
    },
  });
}

export function useSendFriendRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation<FriendshipResponse, Error, { username: string }>({
    mutationFn: async (payload) => {
      const response = await sendFriendRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'send friend request');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendRequestsKey }),
  });
}

export function useAcceptFriendRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation<FriendshipResponse, Error, string>({
    mutationFn: async (friendshipId) => {
      const response = await acceptFriendRequest(friendshipId);
      if (!response.ok || !response.data) throwApiError(response, 'accept friend request');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKey });
      queryClient.invalidateQueries({ queryKey: friendRequestsKey });
    },
  });
}

export function useRemoveFriendshipMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (friendshipId) => {
      const response = await removeFriendshipRequest(friendshipId);
      if (!response.ok) throwApiError(response, 'remove friendship');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKey });
      queryClient.invalidateQueries({ queryKey: friendRequestsKey });
    },
  });
}
