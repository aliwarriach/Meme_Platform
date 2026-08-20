import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import type { MemeResponse } from '@/services/memes';
import { appendImageToFormData } from '@/utils/multipartImage';

export type ChallengeType = 'intra_community' | 'community_vs_community' | 'open' | 'duel';
export type ChallengeStatus = 'setup' | 'active' | 'evaluated';

export interface ChallengeSideResponse {
  id: string;
  name: string;
  community_id: string | null;
  member_ids: string[];
  participant_count: number;
  score: number | null;
}

export interface ChallengeResponse {
  id: string;
  // Null for `open` and `duel` challenges — both are platform-level, no community.
  community_id: string | null;
  opponent_community_id: string | null;
  hashtag: string | null;
  creator: PublicUserResponse;
  // `duel` only: the challenged friend, set from proposal even before they've accepted.
  invitee_id: string | null;
  invitee: PublicUserResponse | null;
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
  submitter: PublicUserResponse;
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

// --- Flat (community-less) endpoints — used by duels and, incidentally, open challenges,
// neither of which has a communityId to put in the URL. ---

export function getChallengeFlatRequest(challengeId: string) {
  return api.get<ChallengeResponse>(`/challenges/${challengeId}`);
}

export function getChallengeResultsFlatRequest(challengeId: string) {
  return api.get<ChallengeResultsResponse>(`/challenges/${challengeId}/results`);
}

export async function createAndSubmitToChallengeRequest(
  challengeId: string,
  image: { uri: string; name: string; type: string },
  caption?: string
) {
  const form = new FormData();
  await appendImageToFormData(form, 'image', image);
  if (caption) form.append('caption', caption);

  return api.post<ChallengeSubmissionResponse>(
    `/challenges/${challengeId}/submissions`,
    form,
    { headers: { 'Content-Type': undefined } }
  );
}

export function proposeDuelRequest(
  opponentId: string,
  payload: { title: string; start_time: string; end_time: string }
) {
  return api.post<ChallengeResponse>(`/challenges/duels/${opponentId}`, payload);
}

export function acceptDuelRequest(challengeId: string) {
  return api.post<ChallengeResponse>(`/challenges/duels/${challengeId}/accept`);
}

export function declineDuelRequest(challengeId: string) {
  return api.delete(`/challenges/duels/${challengeId}/decline`);
}

// --- Open challenges + cross-community "mine" list (Phase 20/18 frontend). ---

export interface OpenChallengeSideSetup {
  name: string;
}

export function createOpenChallengeRequest(payload: {
  title: string;
  hashtag: string;
  start_time: string;
  end_time: string;
  sides: OpenChallengeSideSetup[];
}) {
  return api.post<ChallengeResponse>('/challenges/open', payload);
}

export function listOpenChallengesRequest() {
  return api.get<ChallengeResponse[]>('/challenges/open');
}

export function joinOpenChallengeRequest(challengeId: string, sideId: string) {
  return api.post<ChallengeResponse>(`/challenges/${challengeId}/join`, { side_id: sideId });
}

export function listMyChallengesRequest() {
  return api.get<ChallengeResponse[]>('/challenges/mine');
}
