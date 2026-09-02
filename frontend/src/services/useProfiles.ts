import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import type { FeedPageResponse } from '@/services/memes';
import { getUserPostsRequest, getUserProfileRequest, type UserProfileResponse } from '@/services/profiles';

const profileKey = (userId: string) => ['profiles', userId] as const;
const userPostsKey = (userId: string) => ['profiles', userId, 'posts'] as const;

export function useUserProfile(userId: string, enabled = true) {
  return useQuery<UserProfileResponse, Error>({
    queryKey: profileKey(userId),
    queryFn: async () => {
      const response = await getUserProfileRequest(userId);
      if (!response.ok || !response.data) throwApiError(response, 'load profile');
      return response.data;
    },
    enabled: enabled && !!userId,
  });
}

// Only ever called once the profile is known to be unlocked (own profile or a friend's) —
// the backend still enforces the same gate itself, this is just the client not bothering
// to fetch what it already knows will 403.
export function useUserPosts(userId: string, enabled: boolean) {
  return useInfiniteQuery<
    FeedPageResponse,
    Error,
    InfiniteData<FeedPageResponse>,
    ReturnType<typeof userPostsKey>,
    string | undefined
  >({
    queryKey: userPostsKey(userId),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getUserPostsRequest(userId, { cursor: pageParam, limit: 24 });
      if (!response.ok || !response.data) throwApiError(response, 'load posts');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: enabled && !!userId,
  });
}
