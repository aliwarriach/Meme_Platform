import { api } from '@/services/api';
import type { TokenResponse } from '@/services/auth';

export interface GooglePendingRegistrationResponse {
  pending_token: string;
  email: string;
}

/** `POST /auth/google` returns one of two shapes depending on whether the Google
 * identity already matches an account — discriminated by the presence of `pending_token`
 * rather than the HTTP status, since apisauce surfaces both 200 and 202 as `ok: true`. */
export type GoogleAuthResponse = TokenResponse | GooglePendingRegistrationResponse;

export function googleAuthRequest(idToken: string) {
  return api.post<GoogleAuthResponse>('/auth/google', { id_token: idToken });
}

export function completeGoogleRegistrationRequest(payload: {
  pending_token: string;
  username: string;
  date_of_birth: string;
}) {
  return api.post<TokenResponse>('/auth/google/complete', payload);
}

export function isPendingRegistration(
  response: GoogleAuthResponse
): response is GooglePendingRegistrationResponse {
  return 'pending_token' in response;
}
