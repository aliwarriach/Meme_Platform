import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  getHashtagFeedHotRequest,
  getHashtagFeedRequest,
  getHashtagRequest,
  searchHashtagsRequest,
  type HashtagResponse,
  type HashtagSuggestionResponse,
} from '@/services/hashtags';
import type { FeedPageResponse, HotFeedPageResponse } from '@/services/memes';

const searchKey = (query: string) => ['hashtags', 'search', query] as const;
const hashtagKey = (slug: string) => ['hashtags', slug] as const;
const hashtagFeedKey = (slug: string) => ['hashtags', slug, 'memes', 'latest'] as const;
const hashtagFeedHotKey = (slug: string) => ['hashtags', slug, 'memes', 'hot'] as const;

const HOT_PAGE_SIZE = 20;

/** Autocomplete lookup — enabled only once the query is non-empty, matching the backend's
 * "empty/punctuation-only query returns []" behaviour rather than firing a request for it. */
export function useHashtagSearch(query: string) {
  return useQuery<HashtagSuggestionResponse[], Error>({
    queryKey: searchKey(query),
    queryFn: async () => {
      const response = await searchHashtagsRequest(query);
      if (!response.ok || !response.data) throwApiError(response, 'search hashtags');
      return response.data;
    },
    enabled: query.trim().length > 0,
  });
}

export function useHashtag(slug: string, enabled = true) {
  return useQuery<HashtagResponse, Error>({
    queryKey: hashtagKey(slug),
    queryFn: async () => {
      const response = await getHashtagRequest(slug);
      if (!response.ok || !response.data) throwApiError(response, 'load hashtag');
      return response.data;
    },
    enabled: enabled && Boolean(slug),
    // A live challenge's score/countdown and the 24h result-card window both change without
    // any action on this screen — poll while there's something worth catching, same
    // rationale as `useChallenge`'s active/setup poll.
    refetchInterval: (query) => (query.state.data?.active_challenge ? 5000 : false),
  });
}

function useHashtagFeedLatest(slug: string, enabled: boolean) {
  return useInfiniteQuery<FeedPageResponse, Error>({
    queryKey: hashtagFeedKey(slug),
    queryFn: async ({ pageParam }) => {
      const response = await getHashtagFeedRequest(slug, pageParam as string | null);
      if (!response.ok || !response.data) throwApiError(response, 'load tag feed');
      return response.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled,
  });
}

function useHashtagFeedHot(slug: string, enabled: boolean) {
  return useInfiniteQuery<
    HotFeedPageResponse,
    Error,
    InfiniteData<HotFeedPageResponse>,
    ReturnType<typeof hashtagFeedHotKey>,
    number
  >({
    queryKey: hashtagFeedHotKey(slug),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await getHashtagFeedHotRequest(slug, pageParam);
      if (!response.ok || !response.data) throwApiError(response, 'load tag feed');
      return response.data;
    },
    // Hot is offset-paginated, not a keyset cursor — a Hot score drifts every second and
    // has no stable cursor to page against (same split as `useFeed` vs `useCommunityFeed`).
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * HOT_PAGE_SIZE : undefined,
    enabled,
  });
}

/** Branches on `sort` rather than exposing one hook with a union return type — Hot and
 * Latest are genuinely different pagination schemes (offset vs. keyset), and a caller
 * needs to know which `InfiniteData` shape it's getting (Roadmap_Search.md S5 step 5).
 * Both underlying queries are always called (never conditionally, to respect the rules of
 * hooks) — the inactive one is simply `enabled: false`, so switching the segmented control
 * doesn't remount either query and a previously-loaded tab stays cached. */
export function useHashtagFeed(slug: string, sort: 'hot' | 'latest' = 'latest') {
  const canFetch = Boolean(slug);
  const hot = useHashtagFeedHot(slug, canFetch && sort === 'hot');
  const latest = useHashtagFeedLatest(slug, canFetch && sort === 'latest');
  return sort === 'hot' ? hot : latest;
}
