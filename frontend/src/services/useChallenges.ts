import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  acceptChallengeRequest,
  createChallengeRequest,
  declineChallengeRequest,
  getChallengeRequest,
  getChallengeResultsRequest,
  getCommunityChallengesRequest,
  proposeVsChallengeRequest,
  submitToChallengeRequest,
  type ChallengeResponse,
  type ChallengeResultsResponse,
  type ChallengeSideSetup,
  type ChallengeSubmissionResponse,
} from '@/services/challenges';

const communityChallengesKey = (communityId: string) =>
  ['challenges', 'community', communityId] as const;
const challengeKey = (communityId: string, challengeId: string) =>
  ['challenges', 'community', communityId, challengeId] as const;
const challengeResultsKey = (communityId: string, challengeId: string) =>
  ['challenges', 'community', communityId, challengeId, 'results'] as const;

export function useCommunityChallenges(communityId: string, enabled: boolean) {
  return useQuery<ChallengeResponse[], Error>({
    queryKey: communityChallengesKey(communityId),
    queryFn: async () => {
      const response = await getCommunityChallengesRequest(communityId);
      if (!response.ok || !response.data) throwApiError(response, 'load challenges');
      return response.data;
    },
    enabled,
  });
}

export function useChallenge(communityId: string, challengeId: string, enabled = true) {
  return useQuery<ChallengeResponse, Error>({
    queryKey: challengeKey(communityId, challengeId),
    queryFn: async () => {
      const response = await getChallengeRequest(communityId, challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'load challenge');
      return response.data;
    },
    enabled,
    // Active challenges' status can flip to "evaluated" server-side at any moment via
    // the background window-close worker, and a pending vs-proposal's status can flip to
    // "active"/disappear the moment the opponent owner responds — poll both cases so the
    // UI catches the transition without the user needing to manually refresh.
    refetchInterval: (query) =>
      query.state.data?.status === 'active' || query.state.data?.status === 'setup'
        ? 5000
        : false,
  });
}

export function useCreateChallengeMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ChallengeResponse,
    Error,
    { title: string; start_time: string; end_time: string; sides: ChallengeSideSetup[] }
  >({
    mutationFn: async (payload) => {
      const response = await createChallengeRequest(communityId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'create challenge');
      return response.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communityChallengesKey(communityId) }),
  });
}

export function useProposeVsChallengeMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ChallengeResponse,
    Error,
    { opponentCommunityId: string; title: string; start_time: string; end_time: string }
  >({
    mutationFn: async ({ opponentCommunityId, ...payload }) => {
      const response = await proposeVsChallengeRequest(communityId, opponentCommunityId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'propose challenge');
      return response.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communityChallengesKey(communityId) }),
  });
}

export function useAcceptChallengeMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<ChallengeResponse, Error, string>({
    mutationFn: async (challengeId) => {
      const response = await acceptChallengeRequest(communityId, challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'accept challenge');
      return response.data;
    },
    onSuccess: (_data, challengeId) => {
      queryClient.invalidateQueries({ queryKey: communityChallengesKey(communityId) });
      queryClient.invalidateQueries({ queryKey: challengeKey(communityId, challengeId) });
    },
  });
}

export function useDeclineChallengeMutation(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (challengeId) => {
      const response = await declineChallengeRequest(communityId, challengeId);
      if (!response.ok) throwApiError(response, 'decline challenge');
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communityChallengesKey(communityId) }),
  });
}

export function useSubmitToChallengeMutation(communityId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation<ChallengeSubmissionResponse, Error, string>({
    mutationFn: async (memeId) => {
      const response = await submitToChallengeRequest(communityId, challengeId, memeId);
      if (!response.ok || !response.data) throwApiError(response, 'submit to challenge');
      return response.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: challengeKey(communityId, challengeId) }),
  });
}

export function useChallengeResults(communityId: string, challengeId: string, enabled: boolean) {
  return useQuery<ChallengeResultsResponse, Error>({
    queryKey: challengeResultsKey(communityId, challengeId),
    queryFn: async () => {
      const response = await getChallengeResultsRequest(communityId, challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'load challenge results');
      return response.data;
    },
    enabled,
  });
}
