import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  getGlobalCommunityLeaderboardRequest,
  getIndividualLeaderboardRequest,
  getInternalCommunityLeaderboardRequest,
  type CommunityLeaderboardPageResponse,
  type IndividualLeaderboardPageResponse,
} from '@/services/leaderboards';

const individualKey = ['leaderboards', 'individual'] as const;
const globalCommunityKey = ['leaderboards', 'communities'] as const;
const internalCommunityKey = (communityId: string) =>
  ['leaderboards', 'communities', communityId] as const;

// `next_cursor` here is a page number as a string (offset pagination, not the
// keyset cursor scheme feed/communities use — see backend services/leaderboards.py).
function nextPage(nextCursor: string | null): number | undefined {
  return nextCursor ? Number(nextCursor) : undefined;
}

export function useIndividualLeaderboard() {
  return useInfiniteQuery<
    IndividualLeaderboardPageResponse,
    Error,
    InfiniteData<IndividualLeaderboardPageResponse>,
    typeof individualKey,
    number
  >({
    queryKey: individualKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getIndividualLeaderboardRequest({ page: pageParam, limit: 20 });
      if (!response.ok || !response.data) throwApiError(response, 'load leaderboard');
      return response.data;
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.next_cursor),
  });
}

export function useGlobalCommunityLeaderboard() {
  return useInfiniteQuery<
    CommunityLeaderboardPageResponse,
    Error,
    InfiniteData<CommunityLeaderboardPageResponse>,
    typeof globalCommunityKey,
    number
  >({
    queryKey: globalCommunityKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getGlobalCommunityLeaderboardRequest({ page: pageParam, limit: 20 });
      if (!response.ok || !response.data) throwApiError(response, 'load community leaderboard');
      return response.data;
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.next_cursor),
  });
}

export function useInternalCommunityLeaderboard(communityId: string, enabled: boolean) {
  return useInfiniteQuery<
    IndividualLeaderboardPageResponse,
    Error,
    InfiniteData<IndividualLeaderboardPageResponse>,
    ReturnType<typeof internalCommunityKey>,
    number
  >({
    queryKey: internalCommunityKey(communityId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getInternalCommunityLeaderboardRequest(communityId, {
        page: pageParam,
        limit: 20,
      });
      if (!response.ok || !response.data) {
        throwApiError(response, 'load community leaderboard');
      }
      return response.data;
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.next_cursor),
    enabled,
  });
}
