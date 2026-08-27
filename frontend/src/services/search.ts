import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import type { ChallengeResponse } from '@/services/challenges';
import type { CommunityResponse } from '@/services/communities';
import type { HashtagSuggestionResponse } from '@/services/hashtags';
import type { MemeResponse } from '@/services/memes';

export type SearchScope = 'all' | 'challenges' | 'posts' | 'people' | 'communities' | 'tags';

export interface SearchSectionResponse<T> {
  items: T[];
  count: number;
  capped: boolean;
  has_more: boolean;
}

export interface SearchAllResponse {
  challenges: SearchSectionResponse<ChallengeResponse>;
  posts: SearchSectionResponse<MemeResponse>;
  people: SearchSectionResponse<PublicUserResponse>;
  communities: SearchSectionResponse<CommunityResponse>;
  tags: SearchSectionResponse<HashtagSuggestionResponse>;
}

// Keyed by scope so a generic caller can look up the right item type — see `useSearch.ts`.
export interface SearchScopeItemMap {
  challenges: ChallengeResponse;
  posts: MemeResponse;
  people: PublicUserResponse;
  communities: CommunityResponse;
  tags: HashtagSuggestionResponse;
}

export function searchAllRequest(q: string) {
  return api.get<SearchAllResponse>('/search', { q, scope: 'all' });
}

export function searchScopeRequest<S extends Exclude<SearchScope, 'all'>>(
  q: string,
  scope: S,
  offset: number,
  limit = 20
) {
  return api.get<SearchSectionResponse<SearchScopeItemMap[S]>>('/search', {
    q,
    scope,
    offset,
    limit,
  });
}
