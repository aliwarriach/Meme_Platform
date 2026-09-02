import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  applyVoteLocally,
  bumpCommentCount,
  cancelContentQueries,
  markScoreSurfacesStale,
  patchMemeInCaches,
  restoreContentCaches,
  snapshotContentCaches,
  type CacheSnapshot,
} from '@/services/optimisticCache';
import {
  addCommentRequest,
  castVoteRequest,
  createCommunityMemeRequest,
  createMemeRequest,
  deleteMemeRequest,
  getCommunityFeedRequest,
  getFeedRequest,
  getMemeEditDataRequest,
  getMemeRequest,
  listCommentsRequest,
  recordMemeViewRequest,
  updateMemeRequest,
  type AudienceType,
  type CommentResponse,
  type FeedPageResponse,
  type MemeEditDataResponse,
  type MemeResponse,
  type MemeViewResponse,
  type MergedFeedPageResponse,
  type VoteResponse,
} from '@/services/memes';

const memesRootKey = ['memes'] as const;
const feedKey = ['memes', 'feed'] as const;
const communityFeedKey = (communityId: string) => ['memes', 'community', communityId] as const;
const memeKey = (memeId: string) => ['memes', memeId] as const;
const memeEditKey = (memeId: string) => ['memes', memeId, 'edit'] as const;
const commentsKey = (memeId: string) => ['memes', memeId, 'comments'] as const;

const FEED_PAGE_SIZE = 20;

/** Cache entries a mutation snapshots before patching, so onError can put them back. */
interface OptimisticContext {
  snapshot: CacheSnapshot;
}

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
      hashtags?: string[];
      editorDocumentJson?: string;
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
      editorDocumentJson?: string;
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

export function useMeme(memeId: string, enabled = true) {
  return useQuery<MemeResponse, Error>({
    queryKey: memeKey(memeId),
    queryFn: async () => {
      const response = await getMemeRequest(memeId);
      if (!response.ok || !response.data) throwApiError(response, 'load post');
      return response.data;
    },
    enabled: enabled && !!memeId,
  });
}

// Author-only edit-screen data. Not shared with the plain `useMeme`/feed caches — deliberately
// its own query key, since `editor_document` is sizable JSON nothing but an edit session needs.
export function useMemeEditData(memeId: string, enabled = true) {
  return useQuery<MemeEditDataResponse, Error>({
    queryKey: memeEditKey(memeId),
    queryFn: async () => {
      const response = await getMemeEditDataRequest(memeId);
      if (!response.ok || !response.data) throwApiError(response, 'load meme for editing');
      return response.data;
    },
    enabled: enabled && !!memeId,
  });
}

export function useUpdateMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    MemeResponse,
    Error,
    {
      memeId: string;
      caption?: string | null;
      hashtags?: string[];
      image?: { uri: string; name: string; type: string };
      editorDocumentJson?: string;
    }
  >({
    mutationFn: async ({ memeId, ...payload }) => {
      const response = await updateMemeRequest(memeId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'update meme');
      return response.data;
    },
    onSuccess: (updated, { memeId }) => {
      // Patch every cached copy in place with the server's fresh `MemeOut`, same precedent
      // as vote/comment mutations — never invalidate the main feed key here. It's Hot-ranked
      // and offset-paginated, so a refetch can reorder/duplicate cards mid-scroll (see
      // [[optimistic-cache]]); the full server response already has everything a feed card
      // renders (image_url/caption), so there's no cheaper-but-incomplete patch to reach for.
      patchMemeInCaches(queryClient, memeId, () => updated);
      queryClient.invalidateQueries({ queryKey: memeEditKey(memeId) });
    },
  });
}

export function useDeleteMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (memeId) => {
      const response = await deleteMemeRequest(memeId);
      if (!response.ok) throwApiError(response, 'delete meme');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKey });
      queryClient.invalidateQueries({ queryKey: memesRootKey });
    },
  });
}

export function useCastVoteMutation() {
  const queryClient = useQueryClient();
  return useMutation<VoteResponse, Error, { memeId: string; value: 1 | -1 }, OptimisticContext>({
    mutationFn: async ({ memeId, value }) => {
      const response = await castVoteRequest(memeId, value);
      if (!response.ok || !response.data) throwApiError(response, 'vote on meme');
      return response.data;
    },
    onMutate: async ({ memeId, value }) => {
      await cancelContentQueries(queryClient, 'meme');
      const snapshot = snapshotContentCaches(queryClient, 'meme');
      patchMemeInCaches(queryClient, memeId, (meme) => applyVoteLocally(meme, value));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreContentCaches(queryClient, context.snapshot);
    },
    // Reconcile against the server's authoritative counts — they drift from the optimistic
    // guess whenever someone else voted on the same meme in between.
    onSuccess: ({ upvote_count, downvote_count, score, viewer_vote }, { memeId }) => {
      patchMemeInCaches(queryClient, memeId, (meme) => ({
        ...meme,
        upvote_count,
        downvote_count,
        score,
        viewer_vote,
      }));
    },
    onSettled: () => markScoreSurfacesStale(queryClient),
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
  return useMutation<CommentResponse, Error, string, OptimisticContext>({
    mutationFn: async (body) => {
      const response = await addCommentRequest(memeId, body);
      if (!response.ok || !response.data) throwApiError(response, 'add comment');
      return response.data;
    },
    // The comment count is denormalized onto every cached copy of the meme, so bump it in
    // place rather than refetching the feed to pick up a +1.
    onMutate: async () => {
      await cancelContentQueries(queryClient, 'meme');
      const snapshot = snapshotContentCaches(queryClient, 'meme');
      patchMemeInCaches(queryClient, memeId, (meme) => bumpCommentCount(meme, 1));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreContentCaches(queryClient, context.snapshot);
    },
    // Only this meme's comment list refetches — it needs the server-assigned id/author for
    // the new row. The feed already has the count it needs from onMutate.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(memeId) }),
    onSettled: () => markScoreSurfacesStale(queryClient),
  });
}
