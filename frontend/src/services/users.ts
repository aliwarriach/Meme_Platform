import { api } from '@/services/api';
import type { PublicUserResponse } from '@/services/auth';

export function searchUsersRequest(query: string, limit = 20) {
  return api.get<PublicUserResponse[]>('/users/search', { q: query, limit });
}
