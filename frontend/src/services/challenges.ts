import { api } from '@/services/api';
import type { AuthUserResponse } from '@/services/auth';
import type { MemeResponse } from '@/services/memes';

export type ChallengeType = 'intra_community' | 'community_vs_community';
export type ChallengeStatus = 'setup' | 'active' | 'evaluated';

export interface ChallengeSideResponse {
  id: string;
  name: string;
  community_id: string | null;
  member_ids: string[];
  score: number | null;
}

export interface ChallengeResponse {
  id: string;
  community_id: string;
  opponent_community_id: string | null;
  creator: AuthUserResponse;
  title: string;
  challenge_type: ChallengeType;
  status: ChallengeStatus;
  start_time: string;
  end_time: string;
  winning_side_id: string | null;
  sides: ChallengeSideResponse[];
}

export interface ChallengeSubmissionResponse {
  id: string;
  side_id: string;
  submitter: AuthUserResponse;
  meme: MemeResponse;
  created_at: string;
}

export interface ChallengeResultsResponse {
  challenge: ChallengeResponse;
  submissions: ChallengeSubmissionResponse[];
}

export interface ChallengeSideSetup {
  name: string;
  member_ids: string[];
}

export function createChallengeRequest(
  communityId: string,
  payload: { title: string; start_time: string; end_time: string; sides: ChallengeSideSetup[] }
) {
  return api.post<ChallengeResponse>(`/communities/${communityId}/challenges`, payload);
}

export function proposeVsChallengeRequest(
  communityId: string,
  opponentCommunityId: string,
  payload: { title: string; start_time: string; end_time: string }
) {
  return api.post<ChallengeResponse>(
    `/communities/${communityId}/challenges/vs/${opponentCommunityId}`,
    payload
  );
}

export function acceptChallengeRequest(communityId: string, challengeId: string) {
  return api.post<ChallengeResponse>(
    `/communities/${communityId}/challenges/${challengeId}/accept`
  );
}

export function declineChallengeRequest(communityId: string, challengeId: string) {
  return api.delete(`/communities/${communityId}/challenges/${challengeId}/decline`);
}

export function getCommunityChallengesRequest(communityId: string) {
  return api.get<ChallengeResponse[]>(`/communities/${communityId}/challenges`);
}

export function getChallengeRequest(communityId: string, challengeId: string) {
  return api.get<ChallengeResponse>(`/communities/${communityId}/challenges/${challengeId}`);
}

export function submitToChallengeRequest(
  communityId: string,
  challengeId: string,
  memeId: string
) {
  return api.post<ChallengeSubmissionResponse>(
    `/communities/${communityId}/challenges/${challengeId}/submissions`,
    undefined,
    { params: { meme_id: memeId } }
  );
}

export function getChallengeResultsRequest(communityId: string, challengeId: string) {
  return api.get<ChallengeResultsResponse>(
    `/communities/${communityId}/challenges/${challengeId}/results`
  );
}
