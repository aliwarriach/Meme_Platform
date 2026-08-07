import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  getHashtagFeedRequest,
  getHashtagRequest,
  searchHashtagsRequest,
  type HashtagResponse,
  type HashtagSuggestionResponse,
} from '@/services/hashtags';
import type { FeedPageResponse } from '@/services/memes';

const searchKey = (query: string) => ['hashtags', 'search', query] as const;
const hashtagKey = (slug: string) => ['hashtags', slug] as const;
const hashtagFeedKey = (slug: string) => ['hashtags', slug, 'memes'] as const;

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
  });
}

export function useHashtagFeed(slug: string) {
  return useInfiniteQuery<FeedPageResponse, Error>({
    queryKey: hashtagFeedKey(slug),
    queryFn: async ({ pageParam }) => {
      const response = await getHashtagFeedRequest(slug, pageParam as string | null);
      if (!response.ok || !response.data) throwApiError(response, 'load tag feed');
      return response.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: Boolean(slug),
  });
}
