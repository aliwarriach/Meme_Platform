import { api } from '@/services/api';
import type { ChallengeResponse } from '@/services/challenges';
import type { FeedPageResponse, HotFeedPageResponse } from '@/services/memes';

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
  // Deprecated alias for `active_challenge.id`, kept for one release — read
  // `active_challenge`/`recent_result_challenge` instead (Roadmap_Search.md S1/S5).
  challenge_id: string | null;
  active_challenge: ChallengeResponse | null;
  recent_result_challenge: ChallengeResponse | null;
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

export function getHashtagFeedHotRequest(slug: string, offset: number, limit = 20) {
  return api.get<HotFeedPageResponse>(`/hashtags/${slug}/memes/hot`, { offset, limit });
}
