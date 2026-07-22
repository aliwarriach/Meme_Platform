import { api } from '@/services/api';

export type BadgeType = 'challenge_winner';

export interface BadgeResponse {
  id: string;
  badge_type: BadgeType;
  challenge_id: string | null;
  points: number;
  label: string;
  created_at: string;
}

export function getMyBadgesRequest() {
  return api.get<BadgeResponse[]>('/auth/me/badges');
}
