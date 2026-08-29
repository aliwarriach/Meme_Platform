import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { throwApiError } from '@/services/api';
import {
  loginRequest,
  passwordResetConfirmRequest,
  passwordResetRequestRequest,
  registerRequest,
  updateAvatarRequest,
  updateBioRequest,
  type AuthUserResponse,
  type TokenResponse,
  type UpdateAvatarPayload,
  type UpdateBioPayload,
} from '@/services/auth';
import { setAvatar, setBio } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

export function useRegisterMutation() {
  return useMutation<
    TokenResponse,
    Error,
    { email: string; username: string; password: string; date_of_birth: string }
  >({
    mutationFn: async (payload) => {
      const response = await registerRequest(payload);
      if (!response.ok || !response.data) {
        throwApiError(response, 'register');
      }
      return response.data;
    },
  });
}

export function useLoginMutation() {
  return useMutation<TokenResponse, Error, { email: string; password: string }>({
    mutationFn: async (payload) => {
      const response = await loginRequest(payload);
      if (!response.ok || !response.data) {
        throwApiError(response, 'login');
      }
      return response.data;
    },
  });
}

/** Step 1 of password recovery — server-call only, no session/Redux involvement (unlike
 * login/register, nothing here is authenticated yet). Always resolves on `204`; the caller
 * must show the same generic "check your email" copy whether or not the address is
 * registered, per `passwordResetRequestRequest`'s own doc comment. */
export function usePasswordResetRequestMutation() {
  return useMutation<void, Error, { email: string }>({
    mutationFn: async (payload) => {
      const response = await passwordResetRequestRequest(payload);
      if (!response.ok) throwApiError(response, 'request password reset');
    },
  });
}

/** Step 2 — confirms the emailed code and sets the new password. Server-call only: a
 * successful reset does NOT log the user in (the backend also bumps `token_version`,
 * invalidating any existing sessions), so the caller routes back to `/login` for a fresh
 * sign-in rather than persisting credentials here. */
export function usePasswordResetConfirmMutation() {
  return useMutation<void, Error, { email: string; code: string; new_password: string }>({
    mutationFn: async (payload) => {
      const response = await passwordResetConfirmRequest(payload);
      if (!response.ok) throwApiError(response, 'reset password');
    },
  });
}

/** Uploading a new photo, picking a built-in preset, and removing the avatar entirely are
 * all the same mutation — `services/auth.ts::UpdateAvatarPayload` picks which. Patches the
 * signed-in user's avatar fields in Redux on success (so the drawer/profile/feed all pick it
 * up immediately) and invalidates this user's own profile query. */
export function useUpdateAvatarMutation() {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();

  return useMutation<AuthUserResponse, Error, UpdateAvatarPayload>({
    mutationFn: async (payload) => {
      const response = await updateAvatarRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'update avatar');
      return response.data;
    },
    onSuccess: (user) => {
      dispatch(setAvatar({ avatarUrl: user.avatar_url, avatarPreset: user.avatar_preset }));
      queryClient.invalidateQueries({ queryKey: ['profiles', user.id] });
    },
  });
}

/** Same "patch Redux + invalidate this user's own profile query" shape as
 * `useUpdateAvatarMutation` above, for the bio editor. */
export function useUpdateBioMutation() {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();

  return useMutation<AuthUserResponse, Error, UpdateBioPayload>({
    mutationFn: async (payload) => {
      const response = await updateBioRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'update bio');
      return response.data;
    },
    onSuccess: (user) => {
      dispatch(setBio(user.bio));
      queryClient.invalidateQueries({ queryKey: ['profiles', user.id] });
    },
  });
}
