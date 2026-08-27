import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  searchAllRequest,
  searchScopeRequest,
  type SearchAllResponse,
  type SearchScope,
  type SearchScopeItemMap,
  type SearchSectionResponse,
} from '@/services/search';
import { getTrendingHashtagsRequest, type TrendingResponse } from '@/services/trending';

const SEARCH_PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;

const trendingKey = ['hashtags', 'trending'] as const;
const searchAllKey = (q: string) => ['search', 'all', q] as const;
const searchScopeKey = (q: string, scope: Exclude<SearchScope, 'all'>) =>
  ['search', 'scope', scope, q] as const;

export function useTrendingHashtags() {
  return useQuery<TrendingResponse, Error>({
    queryKey: trendingKey,
    queryFn: async () => {
      const response = await getTrendingHashtagsRequest(25);
      if (!response.ok || !response.data) throwApiError(response, 'load trending hashtags');
      return response.data;
    },
  });
}

/** Backs the `scope=all` preview — one request, five capped sections, powers the tab
 * chip counts (Roadmap_Search.md S3/S6). Enabled only once the query clears the same
 * 2-char minimum the backend enforces, so a 1-char query never fires a request at all. */
export function useSearchAll(query: string) {
  const q = query.trim();
  return useQuery<SearchAllResponse, Error>({
    queryKey: searchAllKey(q),
    queryFn: async () => {
      const response = await searchAllRequest(q);
      if (!response.ok || !response.data) throwApiError(response, 'search');
      return response.data;
    },
    enabled: q.length >= MIN_QUERY_LENGTH,
  });
}

export function useSearchScope<S extends Exclude<SearchScope, 'all'>>(
  query: string,
  scope: S,
  enabled: boolean
) {
  const q = query.trim();
  return useInfiniteQuery<
    SearchSectionResponse<SearchScopeItemMap[S]>,
    Error,
    InfiniteData<SearchSectionResponse<SearchScopeItemMap[S]>>,
    ReturnType<typeof searchScopeKey>,
    number
  >({
    queryKey: searchScopeKey(q, scope),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await searchScopeRequest(q, scope, pageParam, SEARCH_PAGE_SIZE);
      if (!response.ok || !response.data) throwApiError(response, 'search');
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * SEARCH_PAGE_SIZE : undefined,
    enabled: enabled && q.length >= MIN_QUERY_LENGTH,
  });
}
