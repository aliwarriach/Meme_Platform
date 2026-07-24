import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  addCommentRequest,
  castVoteRequest,
  createCommunityMemeRequest,
  createMemeRequest,
  getCommunityFeedRequest,
  getFeedRequest,
  listCommentsRequest,
  recordMemeViewRequest,
  type AudienceType,
  type CommentResponse,
  type FeedPageResponse,
  type MemeResponse,
  type MemeViewResponse,
  type MergedFeedPageResponse,
  type VoteResponse,
} from '@/services/memes';

const memesRootKey = ['memes'] as const;
const feedKey = ['memes', 'feed'] as const;
const communityFeedKey = (communityId: string) => ['memes', 'community', communityId] as const;
const commentsKey = (memeId: string) => ['memes', memeId, 'comments'] as const;

const FEED_PAGE_SIZE = 20;

export function useFeed() {
  return useInfiniteQuery<
    MergedFeedPageResponse,
    Error,
    InfiniteData<MergedFeedPageResponse>,
    typeof feedKey,
    number
  >({
    queryKey: feedKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await getFeedRequest({ offset: pageParam, limit: FEED_PAGE_SIZE });
      if (!response.ok || !response.data) throwApiError(response, 'load feed');
      return response.data;
    },
    // Main feed is Hot-ranked (Reddit-style vote score vs. age), not recency, so pages
    // are offset-based rather than a keyset cursor — the next offset is just how many
    // items have been loaded so far.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * FEED_PAGE_SIZE : undefined,
  });
}

export function useCreateMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    MemeResponse,
    Error,
    {
      imageUri: string;
      imageName: string;
      imageType: string;
      caption?: string;
      audiences: AudienceType[];
    }
  >({
    mutationFn: async (payload) => {
      const response = await createMemeRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'create meme');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

export function useCreateCommunityMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    MemeResponse,
    Error,
    {
      communityId: string;
      imageUri: string;
      imageName: string;
      imageType: string;
      caption?: string;
    }
  >({
    mutationFn: async (payload) => {
      const response = await createCommunityMemeRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'post to community');
      return response.data;
    },
    // Covers both the public feed (if the community is open) and this community's
    // feed in one go, without knowing in advance whether the post went public.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memesRootKey }),
  });
}

export function useCommunityFeed(communityId: string, enabled: boolean) {
  return useInfiniteQuery<
    FeedPageResponse,
    Error,
    InfiniteData<FeedPageResponse>,
    ReturnType<typeof communityFeedKey>,
    string | undefined
  >({
    queryKey: communityFeedKey(communityId),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getCommunityFeedRequest(communityId, { cursor: pageParam, limit: 20 });
      if (!response.ok || !response.data) throwApiError(response, 'load community feed');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled,
  });
}

export function useCastVoteMutation() {
  const queryClient = useQueryClient();
  return useMutation<VoteResponse, Error, { memeId: string; value: 1 | -1 }>({
    mutationFn: async ({ memeId, value }) => {
      const response = await castVoteRequest(memeId, value);
      if (!response.ok || !response.data) throwApiError(response, 'vote on meme');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memesRootKey }),
  });
}

// Fire-and-forget: recording a view must NOT invalidate the feed — that would refetch on
// every impression as the user scrolls. The counter updates lazily; the score cron picks it
// up. Callers fire this once per meme becoming visible (see the feed's viewability handler).
export function useRecordMemeViewMutation() {
  return useMutation<MemeViewResponse, Error, string>({
    mutationFn: async (memeId) => {
      const response = await recordMemeViewRequest(memeId);
      if (!response.ok || !response.data) throwApiError(response, 'record view');
      return response.data;
    },
  });
}

export function useComments(memeId: string, enabled: boolean) {
  return useQuery<CommentResponse[], Error>({
    queryKey: commentsKey(memeId),
    queryFn: async () => {
      const response = await listCommentsRequest(memeId);
      if (!response.ok || !response.data) throwApiError(response, 'load comments');
      return response.data;
    },
    enabled,
  });
}

export function useAddCommentMutation(memeId: string) {
  const queryClient = useQueryClient();
  return useMutation<CommentResponse, Error, string>({
    mutationFn: async (body) => {
      const response = await addCommentRequest(memeId, body);
      if (!response.ok || !response.data) throwApiError(response, 'add comment');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(memeId) });
      queryClient.invalidateQueries({ queryKey: memesRootKey });
    },
  });
}
