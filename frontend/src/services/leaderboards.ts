import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';

export interface IndividualLeaderboardEntryResponse {
  rank: number;
  user: PublicUserResponse;
  score: number;
}

export interface IndividualLeaderboardPageResponse {
  items: IndividualLeaderboardEntryResponse[];
  next_cursor: string | null;
}

export interface CommunityLeaderboardEntryResponse {
  rank: number;
  community_id: string;
  community_name: string;
  score: number;
}

export interface CommunityLeaderboardPageResponse {
  items: CommunityLeaderboardEntryResponse[];
  next_cursor: string | null;
}

export function getIndividualLeaderboardRequest(params: { page?: number; limit?: number }) {
  return api.get<IndividualLeaderboardPageResponse>('/leaderboards/individual', params);
}

export function getGlobalCommunityLeaderboardRequest(params: { page?: number; limit?: number }) {
  return api.get<CommunityLeaderboardPageResponse>('/leaderboards/communities', params);
}

export function getInternalCommunityLeaderboardRequest(
  communityId: string,
  params: { page?: number; limit?: number }
) {
  return api.get<IndividualLeaderboardPageResponse>(
    `/communities/${communityId}/leaderboard`,
    params
  );
}

// A user's lifetime, all-time cumulative MemeScore (the "Snapchat Score") — distinct from
// the 30-day-windowed individual leaderboard above. See backend services/scoring.py.
export interface ProfileScoreResponse {
  user: PublicUserResponse;
  score: number;
}

export function getProfileScoreRequest(userId: string) {
  return api.get<ProfileScoreResponse>(`/leaderboards/profile/${userId}`);
}
