import { api } from '@/services/api';
import type { FeedPageResponse } from '@/services/memes';

export interface HashtagSuggestionResponse {
  id: string;
  slug: string;
  display_text: string;
  challenge_id: string | null;
  challenge_title: string | null;
}

export interface HashtagResponse {
  id: string;
  slug: string;
  display_text: string;
  meme_count: number;
  challenge_id: string | null;
}

export function searchHashtagsRequest(query: string, limit = 10) {
  return api.get<HashtagSuggestionResponse[]>('/hashtags/search', { q: query, limit });
}

export function getHashtagRequest(slug: string) {
  return api.get<HashtagResponse>(`/hashtags/${slug}`);
}

export function getHashtagFeedRequest(slug: string, cursor: string | null, limit = 20) {
  return api.get<FeedPageResponse>(`/hashtags/${slug}/memes`, {
    limit,
    ...(cursor ? { cursor } : {}),
  });
}
