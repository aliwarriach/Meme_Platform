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
  addReactionRequest,
  createCommunityMemeRequest,
  createMemeRequest,
  getCommunityFeedRequest,
  getFeedRequest,
  listCommentsRequest,
  removeReactionRequest,
  type AudienceType,
  type CommentResponse,
  type FeedPageResponse,
  type MemeResponse,
  type MergedFeedPageResponse,
} from '@/services/memes';

const memesRootKey = ['memes'] as const;
const feedKey = ['memes', 'feed'] as const;
const communityFeedKey = (communityId: string) => ['memes', 'community', communityId] as const;
const commentsKey = (memeId: string) => ['memes', memeId, 'comments'] as const;

export function useFeed() {
  return useInfiniteQuery<
    MergedFeedPageResponse,
    Error,
    InfiniteData<MergedFeedPageResponse>,
    typeof feedKey,
    string | undefined
  >({
    queryKey: feedKey,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getFeedRequest({ cursor: pageParam, limit: 20 });
      if (!response.ok || !response.data) throwApiError(response, 'load feed');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
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

export function useAddReactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (memeId) => {
      const response = await addReactionRequest(memeId);
      if (!response.ok) throwApiError(response, 'add reaction');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memesRootKey }),
  });
}

export function useRemoveReactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (memeId) => {
      const response = await removeReactionRequest(memeId);
      if (!response.ok) throwApiError(response, 'remove reaction');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memesRootKey }),
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
