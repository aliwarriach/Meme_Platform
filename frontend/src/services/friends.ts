import { api } from '@/services/api';
import type { AuthUserResponse } from '@/services/auth';

export interface FriendshipResponse {
  id: string;
  status: 'pending' | 'accepted';
  requester: AuthUserResponse;
  addressee: AuthUserResponse;
  created_at: string;
}

export interface FriendResponse {
  friendship_id: string;
  user: AuthUserResponse;
}

export function listFriendsRequest() {
  return api.get<FriendResponse[]>('/friends');
}

export function listIncomingFriendRequestsRequest() {
  return api.get<FriendshipResponse[]>('/friends/requests');
}

export function sendFriendRequest(payload: { username: string }) {
  return api.post<FriendshipResponse>('/friends/requests', payload);
}

export function acceptFriendRequest(friendshipId: string) {
  return api.post<FriendshipResponse>(`/friends/requests/${friendshipId}/accept`);
}

export function removeFriendshipRequest(friendshipId: string) {
  return api.delete(`/friends/${friendshipId}`);
}
