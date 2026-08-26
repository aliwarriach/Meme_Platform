import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { throwApiError } from '@/services/api';
import {
  loginRequest,
  registerRequest,
  updateAvatarRequest,
  type AuthUserResponse,
  type TokenResponse,
  type UpdateAvatarPayload,
} from '@/services/auth';
import { setAvatar } from '@/store/authSlice';
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
