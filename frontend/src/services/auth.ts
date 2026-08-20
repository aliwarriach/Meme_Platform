import { api } from '@/services/api';

/** Another user's public profile fields — no email. Used for authors, senders, members,
 * leaderboard entries and every other embedded-user position the API returns. */
export interface PublicUserResponse {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

/** The signed-in user's own account — carries email. Only ever appears as
 * `TokenResponse.user`; never use this for representing another user. */
export interface AuthUserResponse extends PublicUserResponse {
  email: string;
  email_verified_at: string | null;
  date_of_birth: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUserResponse;
}

export function registerRequest(payload: {
  email: string;
  username: string;
  password: string;
  date_of_birth: string;
}) {
  return api.post<TokenResponse>('/auth/register', payload);
}

export function loginRequest(payload: { email: string; password: string }) {
  return api.post<TokenResponse>('/auth/login', payload);
}
