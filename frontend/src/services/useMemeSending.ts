import { useMutation, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import { sendMemeRequest, type MemeSendResponse } from '@/services/memeSending';

/**
 * All that's left of the pre-Phase-19 meme-sending hooks: the feed's "↗ Send" shortcut.
 * Reading, replying and read state are conversation operations now — see `useMessaging.ts`.
 */
export function useSendMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeSendResponse, Error, { recipientId: string; memeId: string }>({
    mutationFn: async (payload) => {
      const response = await sendMemeRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'send meme');
      return response.data;
    },
    // The send lands in a thread that may not exist in the cached list yet, and the shim
    // doesn't tell us which conversation it used — so this one refetches rather than patches.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] }),
  });
}
