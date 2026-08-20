import { useMutation } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import { confirmEmailOtpRequest, requestEmailOtpRequest } from '@/services/emailVerification';

export function useRequestEmailOtpMutation() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await requestEmailOtpRequest();
      if (!response.ok) throwApiError(response, 'request email verification code');
    },
  });
}

export function useConfirmEmailOtpMutation() {
  return useMutation<void, Error, string>({
    mutationFn: async (code) => {
      const response = await confirmEmailOtpRequest(code);
      if (!response.ok) throwApiError(response, 'confirm email verification code');
    },
  });
}
