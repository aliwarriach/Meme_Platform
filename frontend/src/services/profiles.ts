import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import type { BadgeResponse } from '@/services/badges';
import type { FeedPageResponse } from '@/services/memes';

export interface UserProfileResponse {
  user: PublicUserResponse;
  score: number;
  // Newest-first, uncapped — the client renders up to 3 + a "+N" overflow chip.
  badges: BadgeResponse[];
  badge_count: number;
  friend_count: number;
  is_self: boolean;
  is_friend: boolean;
  // True for a non-friend viewing someone else's profile — the posts grid stays locked
  // (backend enforces this itself on GET /users/{id}/posts; this just tells the client
  // it's not worth the guaranteed-403 round trip). See backend services/profiles.py.
  posts_locked: boolean;
}

export function getUserProfileRequest(userId: string) {
  return api.get<UserProfileResponse>(`/users/${userId}/profile`);
}

export function getUserPostsRequest(userId: string, params: { cursor?: string; limit?: number }) {
  return api.get<FeedPageResponse>(`/users/${userId}/posts`, params);
}
