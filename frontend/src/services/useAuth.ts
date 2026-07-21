import { useMutation } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import { loginRequest, registerRequest, type TokenResponse } from '@/services/auth';

export function useRegisterMutation() {
  return useMutation<TokenResponse, Error, { email: string; username: string; password: string }>({
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
