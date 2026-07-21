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
  createMemeRequest,
  getFeedRequest,
  listCommentsRequest,
  removeReactionRequest,
  type AudienceType,
  type CommentResponse,
  type FeedPageResponse,
  type MemeResponse,
} from '@/services/memes';

const feedKey = ['memes', 'feed'] as const;
const commentsKey = (memeId: string) => ['memes', memeId, 'comments'] as const;

export function useFeed() {
  return useInfiniteQuery<FeedPageResponse, Error, InfiniteData<FeedPageResponse>, typeof feedKey, string | undefined>({
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

export function useAddReactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (memeId) => {
      const response = await addReactionRequest(memeId);
      if (!response.ok) throwApiError(response, 'add reaction');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

export function useRemoveReactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (memeId) => {
      const response = await removeReactionRequest(memeId);
      if (!response.ok) throwApiError(response, 'remove reaction');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
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
      queryClient.invalidateQueries({ queryKey: feedKey });
    },
  });
}
