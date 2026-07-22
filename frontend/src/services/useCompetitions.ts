import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  castVoteRequest,
  getCurrentStandingsRequest,
  getWinnerRequest,
  type CompetitionPeriodType,
  type StandingsPageResponse,
  type VoteResponse,
  type WinnerResponse,
} from '@/services/competitions';

const standingsKey = (periodType: CompetitionPeriodType) =>
  ['competitions', periodType, 'current'] as const;
const winnerKey = (periodType: CompetitionPeriodType, periodKey: string) =>
  ['competitions', periodType, 'winner', periodKey] as const;

export function useCurrentStandings(periodType: CompetitionPeriodType) {
  return useQuery<StandingsPageResponse, Error>({
    queryKey: standingsKey(periodType),
    queryFn: async () => {
      const response = await getCurrentStandingsRequest(periodType);
      if (!response.ok || !response.data) throwApiError(response, 'load standings');
      return response.data;
    },
  });
}

// A period only has a decided winner once it's closed — enable this once the caller
// knows (e.g. from a past period picker) which closed period key to look up.
export function useWinner(
  periodType: CompetitionPeriodType,
  periodKey: string,
  enabled: boolean
) {
  return useQuery<WinnerResponse, Error>({
    queryKey: winnerKey(periodType, periodKey),
    queryFn: async () => {
      const response = await getWinnerRequest(periodType, periodKey);
      if (!response.ok || !response.data) throwApiError(response, 'load winner');
      return response.data;
    },
    enabled,
  });
}

export function useCastVoteMutation(periodType: CompetitionPeriodType) {
  const queryClient = useQueryClient();
  return useMutation<VoteResponse, Error, string>({
    mutationFn: async (memeId) => {
      const response = await castVoteRequest(periodType, memeId);
      if (!response.ok || !response.data) throwApiError(response, 'cast vote');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: standingsKey(periodType) }),
  });
}
