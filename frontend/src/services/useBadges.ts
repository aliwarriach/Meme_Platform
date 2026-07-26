import { useQuery } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import { getMyBadgesRequest, type BadgeResponse } from '@/services/badges';

const myBadgesKey = ['badges', 'mine'] as const;

export function useMyBadges() {
  return useQuery<BadgeResponse[], Error>({
    queryKey: myBadgesKey,
    queryFn: async () => {
      const response = await getMyBadgesRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load badges');
      return response.data;
    },
  });
}
