import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  acknowledgeSendRequest,
  getInboxRequest,
  getSentRequest,
  reactToSendRequest,
  sendMemeRequest,
  type MemeSendResponse,
} from '@/services/memeSending';
import { onMemeSendingMessage } from '@/services/memeSendingSocket';

const inboxKey = ['meme-sending', 'inbox'] as const;
const sentKey = ['meme-sending', 'sent'] as const;

export function useInbox() {
  return useQuery<MemeSendResponse[], Error>({
    queryKey: inboxKey,
    queryFn: async () => {
      const response = await getInboxRequest();
      if (!response.ok || !response.data) throwApiError(response, 'get inbox');
      return response.data;
    },
  });
}

export function useSentMemes() {
  return useQuery<MemeSendResponse[], Error>({
    queryKey: sentKey,
    queryFn: async () => {
      const response = await getSentRequest();
      if (!response.ok || !response.data) throwApiError(response, 'get sent memes');
      return response.data;
    },
  });
}

// Invalidates the inbox/sent queries whenever the socket delivers a live update, so a
// connected client's UI updates without a manual refresh — the actual real-time part of
// the exit test.
export function useMemeSendingSocketSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onMemeSendingMessage((message) => {
      if (message.type === 'meme_received') {
        queryClient.invalidateQueries({ queryKey: inboxKey });
      } else if (message.type === 'meme_send_reaction') {
        queryClient.invalidateQueries({ queryKey: sentKey });
      }
    });
  }, [queryClient]);
}

export function useSendMemeMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeSendResponse, Error, { recipientId: string; memeId: string }>({
    mutationFn: async (payload) => {
      const response = await sendMemeRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'send meme');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sentKey }),
  });
}

export function useAcknowledgeSendMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeSendResponse, Error, string>({
    mutationFn: async (sendId) => {
      const response = await acknowledgeSendRequest(sendId);
      if (!response.ok || !response.data) throwApiError(response, 'acknowledge meme send');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
  });
}

export function useReactToSendMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeSendResponse, Error, { sendId: string; reaction: string }>({
    mutationFn: async ({ sendId, reaction }) => {
      const response = await reactToSendRequest(sendId, reaction);
      if (!response.ok || !response.data) throwApiError(response, 'react to meme send');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
  });
}
