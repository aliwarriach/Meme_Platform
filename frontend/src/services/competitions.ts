import { api } from '@/services/api';
import type { MemeResponse } from '@/services/memes';

export type CompetitionPeriodType = 'day' | 'week' | 'month';

export interface StandingEntryResponse {
  rank: number;
  meme: MemeResponse;
  vote_count: number;
}

export interface StandingsPageResponse {
  period_type: CompetitionPeriodType;
  period_key: string;
  is_closed: boolean;
  items: StandingEntryResponse[];
}

export interface VoteResponse {
  id: string;
  meme_id: string;
  period_type: CompetitionPeriodType;
  period_key: string;
}

export interface WinnerResponse {
  period_type: CompetitionPeriodType;
  period_key: string;
  meme: MemeResponse | null;
  vote_count: number;
}

export function castVoteRequest(periodType: CompetitionPeriodType, memeId: string) {
  return api.post<VoteResponse>(`/competitions/${periodType}/votes/${memeId}`);
}

export function getCurrentStandingsRequest(periodType: CompetitionPeriodType, limit = 20) {
  return api.get<StandingsPageResponse>(`/competitions/${periodType}/current`, { limit });
}

export function getWinnerRequest(periodType: CompetitionPeriodType, periodKey: string) {
  return api.get<WinnerResponse>(`/competitions/${periodType}/winner`, { period_key: periodKey });
}
