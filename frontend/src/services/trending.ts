import { api } from '@/services/api';
import type { ChallengeResponse } from '@/services/challenges';

export interface TrendingHashtagResponse {
  slug: string;
  display_text: string;
  meme_count_24h: number;
  author_count_24h: number;
  reason: 'trending' | 'live_challenge' | 'popular';
  challenge: Pick<ChallengeResponse, 'id' | 'title' | 'end_time' | 'status'> | null;
}

export interface TrendingResponse {
  items: TrendingHashtagResponse[];
  generated_at: string;
}

export function getTrendingHashtagsRequest(limit = 10) {
  return api.get<TrendingResponse>('/hashtags/trending', { limit });
}
