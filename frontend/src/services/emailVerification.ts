import { api } from '@/services/api';

export function requestEmailOtpRequest() {
  return api.post<void>('/auth/email/verify/request');
}

export function confirmEmailOtpRequest(code: string) {
  return api.post<void>('/auth/email/verify/confirm', { code });
}
