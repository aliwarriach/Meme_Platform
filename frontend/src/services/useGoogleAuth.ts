import { useMutation } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  completeGoogleRegistrationRequest,
  googleAuthRequest,
  type GoogleAuthResponse,
} from '@/services/googleAuth';
import type { TokenResponse } from '@/services/auth';

export function useGoogleAuthMutation() {
  return useMutation<GoogleAuthResponse, Error, string>({
    mutationFn: async (idToken) => {
      const response = await googleAuthRequest(idToken);
      if (!response.ok || !response.data) throwApiError(response, 'sign in with Google');
      return response.data;
    },
  });
}

export function useCompleteGoogleRegistrationMutation() {
  return useMutation<
    TokenResponse,
    Error,
    { pending_token: string; username: string; date_of_birth: string }
  >({
    mutationFn: async (payload) => {
      const response = await completeGoogleRegistrationRequest(payload);
      if (!response.ok || !response.data) {
        throwApiError(response, 'complete Google sign-up');
      }
      return response.data;
    },
  });
}
