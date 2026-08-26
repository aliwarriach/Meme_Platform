import { api } from '@/services/api';

/** Another user's public profile fields — no email. Used for authors, senders, members,
 * leaderboard entries and every other embedded-user position the API returns. */
export interface PublicUserResponse {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_preset: string | null;
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

/** Avatar state is a closed set of mutually exclusive moves — pass exactly one. `PATCH
 * /auth/me` is a `Form()` endpoint (shared with the legacy multipart-file upload path), so
 * even these non-file fields go over as `multipart/form-data`, not JSON. */
export type UpdateAvatarPayload =
  | { kind: 'public_id'; avatar_public_id: string }
  | { kind: 'preset'; avatar_preset: string }
  | { kind: 'clear' };

export function updateAvatarRequest(payload: UpdateAvatarPayload) {
  const form = new FormData();
  if (payload.kind === 'public_id') form.append('avatar_public_id', payload.avatar_public_id);
  else if (payload.kind === 'preset') form.append('avatar_preset', payload.avatar_preset);
  else form.append('clear_avatar', 'true');
  // apisauce defaults every request to `Content-Type: application/json` — left as-is here,
  // axios would JSON.stringify this FormData instead of sending real multipart, and the
  // `Form()`-based `/auth/me` endpoint would silently see none of these fields. Same override
  // every other multipart call in this codebase already uses (e.g. services/communities.ts).
  return api.patch<AuthUserResponse>('/auth/me', form, { headers: { 'Content-Type': undefined } });
}
