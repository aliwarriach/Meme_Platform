import { api } from '@/services/api';
import type { MemeContainerResponse } from '@/services/instagram';
import type { MemeResponse } from '@/services/memes';

export type CompetitionPeriodType = 'day' | 'week' | 'month';

// Native memes and MemeContainers (Instagram Companion Mode) compete together in one
// ranking — see backend services/competitions.py::_standings_query.
export type StandingContent =
  | { kind: 'meme'; meme: MemeResponse }
  | { kind: 'container'; container: MemeContainerResponse };

export interface StandingEntryResponse {
  rank: number;
  content: StandingContent;
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

export interface ContainerVoteResponse {
  id: string;
  meme_container_id: string;
  period_type: CompetitionPeriodType;
  period_key: string;
}

export interface WinnerResponse {
  period_type: CompetitionPeriodType;
  period_key: string;
  content: StandingContent | null;
  vote_count: number;
}

export function castVoteRequest(periodType: CompetitionPeriodType, memeId: string) {
  return api.post<VoteResponse>(`/competitions/${periodType}/votes/${memeId}`);
}

export function castContainerVoteRequest(periodType: CompetitionPeriodType, containerId: string) {
  return api.post<ContainerVoteResponse>(
    `/competitions/${periodType}/container-votes/${containerId}`
  );
}

export function getCurrentStandingsRequest(periodType: CompetitionPeriodType, limit = 20) {
  return api.get<StandingsPageResponse>(`/competitions/${periodType}/current`, { limit });
}

export function getWinnerRequest(periodType: CompetitionPeriodType, periodKey: string) {
  return api.get<WinnerResponse>(`/competitions/${periodType}/winner`, { period_key: periodKey });
}
