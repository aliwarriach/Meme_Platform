import { api } from '@/services/api';

export interface AuthUserResponse {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUserResponse;
}

export function registerRequest(payload: { email: string; username: string; password: string }) {
  return api.post<TokenResponse>('/auth/register', payload);
}

export function loginRequest(payload: { email: string; password: string }) {
  return api.post<TokenResponse>('/auth/login', payload);
}
