import { api } from '@/services/api';
import type { MemeContainerResponse } from '@/services/instagram';
import type { MemeResponse } from '@/services/memes';

export type CompetitionPeriodType = 'day' | 'week' | 'month';

// Native memes and MemeContainers (Instagram Companion Mode) compete together in one
// ranking — see backend services/competitions.py::_standings_query. Standings are ranked
// by net vote score (upvotes minus downvotes cast within the period window), derived
// automatically from the same upvote/downvote votes cast via /memes/{id}/votes and
// /instagram/containers/{id}/votes — there's no separate "cast a competition vote" action.
export type StandingContent =
  | { kind: 'meme'; meme: MemeResponse }
  | { kind: 'container'; container: MemeContainerResponse };

export interface StandingEntryResponse {
  rank: number;
  content: StandingContent;
  score: number;
}

export interface StandingsPageResponse {
  period_type: CompetitionPeriodType;
  period_key: string;
  is_closed: boolean;
  items: StandingEntryResponse[];
}

export interface WinnerResponse {
  period_type: CompetitionPeriodType;
  period_key: string;
  content: StandingContent | null;
  score: number;
}

export function getCurrentStandingsRequest(periodType: CompetitionPeriodType, limit = 20) {
  return api.get<StandingsPageResponse>(`/competitions/${periodType}/current`, { limit });
}

export function getWinnerRequest(periodType: CompetitionPeriodType, periodKey: string) {
  return api.get<WinnerResponse>(`/competitions/${periodType}/winner`, { period_key: periodKey });
}
