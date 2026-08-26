import { useQuery } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';
import { searchUsersRequest } from '@/services/users';

export function useSearchUsers(query: string, enabled: boolean) {
  return useQuery<PublicUserResponse[], Error>({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      const response = await searchUsersRequest(query);
      if (!response.ok || !response.data) throwApiError(response, 'search users');
      return response.data;
    },
    enabled: enabled && query.trim().length > 0,
  });
}
