import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  acceptChallengeRequest,
  acceptDuelRequest,
  createAndSubmitToChallengeRequest,
  createChallengeRequest,
  createOpenChallengeRequest,
  declineChallengeRequest,
  declineDuelRequest,
  getChallengeFlatRequest,
  getChallengeRequest,
  getChallengeResultsFlatRequest,
  getChallengeResultsRequest,
  getCommunityChallengesRequest,
  joinOpenChallengeRequest,
  listMyChallengesRequest,
  listOpenChallengesRequest,
  proposeDuelRequest,
  proposeVsChallengeRequest,
  submitToChallengeRequest,
  type ChallengeResponse,
  type ChallengeResultsResponse,
  type ChallengeSideSetup,
  type ChallengeSubmissionResponse,
  type OpenChallengeSideSetup,
} from '@/services/challenges';

const communityChallengesKey = (communityId: string) =>
  ['challenges', 'community', communityId] as const;
const challengeKey = (communityId: string, challengeId: string) =>
  ['challenges', 'community', communityId, challengeId] as const;
const challengeResultsKey = (communityId: string, challengeId: string) =>
  ['challenges', 'community', communityId, challengeId, 'results'] as const;
const challengeFlatKey = (challengeId: string) => ['challenges', 'flat', challengeId] as const;
const challengeFlatResultsKey = (challengeId: string) =>
  ['challenges', 'flat', challengeId, 'results'] as const;
const openChallengesKey = ['challenges', 'open'] as const;
const myChallengesKey = ['challenges', 'mine'] as const;

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

// --- Flat (community-less) — duels, and usable for `open` challenges too. ---

export function useChallengeFlat(challengeId: string) {
  return useQuery<ChallengeResponse, Error>({
    queryKey: challengeFlatKey(challengeId),
    queryFn: async () => {
      const response = await getChallengeFlatRequest(challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'load challenge');
      return response.data;
    },
    enabled: Boolean(challengeId),
    // Same rationale as the community-scoped `useChallenge`: a pending duel's status can
    // flip the moment the invitee responds, and an active one closes on the background
    // worker's own schedule — poll both so the screen catches it without a manual refresh.
    refetchInterval: (query) =>
      query.state.data?.status === 'active' || query.state.data?.status === 'setup'
        ? 5000
        : false,
  });
}

export function useChallengeResultsFlat(challengeId: string, enabled: boolean) {
  return useQuery<ChallengeResultsResponse, Error>({
    queryKey: challengeFlatResultsKey(challengeId),
    queryFn: async () => {
      const response = await getChallengeResultsFlatRequest(challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'load challenge results');
      return response.data;
    },
    enabled,
  });
}

/** `challengeId` is a call-time variable, not a hook argument — the creator can target
 * either the challenge it was opened from (URL param) or one resolved from a typed
 * hashtag mid-session, so the target isn't known when the hook is created. */
export function useCreateAndSubmitToChallengeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ChallengeSubmissionResponse,
    Error,
    { challengeId: string; image: { uri: string; name: string; type: string }; caption?: string }
  >({
    mutationFn: async ({ challengeId, image, caption }) => {
      const response = await createAndSubmitToChallengeRequest(challengeId, image, caption);
      if (!response.ok || !response.data) throwApiError(response, 'submit to challenge');
      return response.data;
    },
    onSuccess: (_data, { challengeId }) =>
      queryClient.invalidateQueries({ queryKey: challengeFlatKey(challengeId) }),
  });
}

export function useProposeDuelMutation() {
  return useMutation<
    ChallengeResponse,
    Error,
    { opponentId: string; title: string; start_time: string; end_time: string }
  >({
    mutationFn: async ({ opponentId, ...payload }) => {
      const response = await proposeDuelRequest(opponentId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'challenge to a duel');
      return response.data;
    },
  });
}

export function useAcceptDuelMutation() {
  const queryClient = useQueryClient();
  return useMutation<ChallengeResponse, Error, string>({
    mutationFn: async (challengeId) => {
      const response = await acceptDuelRequest(challengeId);
      if (!response.ok || !response.data) throwApiError(response, 'accept duel');
      return response.data;
    },
    onSuccess: (_data, challengeId) =>
      queryClient.invalidateQueries({ queryKey: challengeFlatKey(challengeId) }),
  });
}

export function useDeclineDuelMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (challengeId) => {
      const response = await declineDuelRequest(challengeId);
      if (!response.ok) throwApiError(response, 'decline duel');
    },
    onSuccess: (_data, challengeId) =>
      queryClient.invalidateQueries({ queryKey: challengeFlatKey(challengeId) }),
  });
}

// --- Open challenges + cross-community "mine" list — back the Compete tab. ---

export function useOpenChallenges() {
  return useQuery<ChallengeResponse[], Error>({
    queryKey: openChallengesKey,
    queryFn: async () => {
      const response = await listOpenChallengesRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load open challenges');
      return response.data;
    },
  });
}

export function useMyChallenges() {
  return useQuery<ChallengeResponse[], Error>({
    queryKey: myChallengesKey,
    queryFn: async () => {
      const response = await listMyChallengesRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load your challenges');
      return response.data;
    },
  });
}

export function useCreateOpenChallengeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ChallengeResponse,
    Error,
    { title: string; hashtag: string; start_time: string; end_time: string; sides: OpenChallengeSideSetup[] }
  >({
    mutationFn: async (payload) => {
      const response = await createOpenChallengeRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'create open challenge');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openChallengesKey });
      queryClient.invalidateQueries({ queryKey: myChallengesKey });
    },
  });
}

export function useJoinOpenChallengeMutation() {
  const queryClient = useQueryClient();
  return useMutation<ChallengeResponse, Error, { challengeId: string; sideId: string }>({
    mutationFn: async ({ challengeId, sideId }) => {
      const response = await joinOpenChallengeRequest(challengeId, sideId);
      if (!response.ok || !response.data) throwApiError(response, 'join challenge');
      return response.data;
    },
    onSuccess: (_data, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: openChallengesKey });
      queryClient.invalidateQueries({ queryKey: myChallengesKey });
      queryClient.invalidateQueries({ queryKey: challengeFlatKey(challengeId) });
    },
  });
}
