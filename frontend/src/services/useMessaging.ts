import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { throwApiError } from '@/services/api';
import {
  listConversationsRequest,
  listMessagesRequest,
  markConversationReadRequest,
  openConversationRequest,
  sendMessageRequest,
  type ConversationResponse,
  type MessagePageResponse,
  type MessageResponse,
  type SendMessagePayload,
} from '@/services/messaging';
import {
  applyMessageToConversations,
  clearUnread,
  insertMessage,
  markOwnMessagesRead,
  removeMessage,
  replaceMessage,
  type ThreadCache,
} from '@/services/messagingCache';
import { onMemeSendingMessage } from '@/services/memeSendingSocket';
import type { AuthUser } from '@/store/authSlice';
import type { RootState } from '@/store/store';

const conversationsKey = ['messaging', 'conversations'] as const;
const threadKey = (conversationId: string) =>
  ['messaging', 'conversations', conversationId, 'messages'] as const;

export function useConversations() {
  return useQuery<ConversationResponse[], Error>({
    queryKey: conversationsKey,
    queryFn: async () => {
      const response = await listConversationsRequest();
      if (!response.ok || !response.data) throwApiError(response, 'list conversations');
      return response.data;
    },
  });
}

export function useConversationMessages(conversationId: string) {
  return useInfiniteQuery<MessagePageResponse, Error>({
    queryKey: threadKey(conversationId),
    queryFn: async ({ pageParam }) => {
      const response = await listMessagesRequest(conversationId, pageParam as string | null);
      if (!response.ok || !response.data) throwApiError(response, 'load conversation');
      return response.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: Boolean(conversationId),
  });
}

export function useOpenConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation<ConversationResponse, Error, string>({
    mutationFn: async (userId) => {
      const response = await openConversationRequest(userId);
      if (!response.ok || !response.data) throwApiError(response, 'start conversation');
      return response.data;
    },
    // Get-or-create, so the list may or may not have grown — a refetch is the only way to
    // know, and this runs once on an explicit user action rather than per message.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/** Optimistically-rendered message; replaced by the server's row once the POST returns. */
function pendingMessage(
  conversationId: string,
  sender: AuthUser,
  payload: SendMessagePayload
): MessageResponse {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conversation_id: conversationId,
    // Redux holds the camelCase client shape; the cache holds wire shapes.
    sender: {
      id: sender.id,
      username: sender.username,
      bio: sender.bio,
      avatar_url: sender.avatarUrl,
    },
    kind: payload.kind,
    body: payload.kind === 'text' ? payload.body : null,
    // A pending meme message has no meme yet — the thread renders it as a sending
    // placeholder rather than guessing at a `MemeResponse` the server hasn't confirmed.
    meme: null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

export function useSendMessageMutation(conversationId: string) {
  const queryClient = useQueryClient();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  return useMutation<
    MessageResponse,
    Error,
    SendMessagePayload,
    { pendingId: string | null }
  >({
    mutationFn: async (payload) => {
      const response = await sendMessageRequest(conversationId, payload);
      if (!response.ok || !response.data) throwApiError(response, 'send message');
      return response.data;
    },
    onMutate: async (payload) => {
      if (!currentUser) return { pendingId: null };
      // Only the thread is cancelled: the conversation list is patched, not refetched, so
      // there's nothing in flight that could clobber it.
      await queryClient.cancelQueries({ queryKey: threadKey(conversationId) });

      const optimistic = pendingMessage(conversationId, currentUser, payload);
      queryClient.setQueryData<ThreadCache>(threadKey(conversationId), (cache) =>
        insertMessage(cache, optimistic)
      );
      queryClient.setQueryData<ConversationResponse[]>(conversationsKey, (conversations) =>
        applyMessageToConversations(conversations, optimistic, { incrementUnread: false })
      );
      return { pendingId: optimistic.id };
    },
    onError: (_error, _payload, context) => {
      if (!context?.pendingId) return;
      // Drop the placeholder rather than restoring a whole snapshot — a message that
      // arrived over the socket while the send was in flight must survive the rollback.
      queryClient.setQueryData<ThreadCache>(threadKey(conversationId), (cache) =>
        removeMessage(cache, context.pendingId as string)
      );
    },
    onSuccess: (message, _payload, context) => {
      queryClient.setQueryData<ThreadCache>(threadKey(conversationId), (cache) =>
        context?.pendingId
          ? replaceMessage(cache, context.pendingId, message)
          : insertMessage(cache, message)
      );
      queryClient.setQueryData<ConversationResponse[]>(conversationsKey, (conversations) =>
        applyMessageToConversations(conversations, message, { incrementUnread: false })
      );
    },
    // Deliberately no onSettled invalidation — see optimisticCache.ts. Refetching the
    // thread here would reload every loaded page and jump the scroll position.
  });
}

export function useMarkConversationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (conversationId) => {
      const response = await markConversationReadRequest(conversationId);
      if (!response.ok) throwApiError(response, 'mark conversation read');
    },
    onMutate: async (conversationId) => {
      // The badge clearing the instant the thread opens is the whole point; waiting for
      // the round trip would leave a stale unread count on screen behind the thread.
      queryClient.setQueryData<ConversationResponse[]>(conversationsKey, (conversations) =>
        clearUnread(conversations, conversationId)
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

function applyIncomingMessage(
  queryClient: QueryClient,
  message: MessageResponse,
  viewerId: string | undefined
): void {
  const isOwn = message.sender.id === viewerId;
  queryClient.setQueryData<ThreadCache>(threadKey(message.conversation_id), (cache) =>
    insertMessage(cache, message)
  );
  queryClient.setQueryData<ConversationResponse[]>(conversationsKey, (conversations) => {
    const next = applyMessageToConversations(conversations, message, { incrementUnread: !isOwn });
    // A first message from someone the client has never listed yet — nothing to patch, so
    // fall back to a refetch for that one case.
    if (next === conversations) {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
    }
    return next;
  });
}

/**
 * Applies live socket frames to the messaging caches. Mounted once at the app root
 * (`_layout.tsx`), not per screen — the conversation list badge has to stay current even
 * while the user is somewhere else entirely.
 */
export function useMessagingSocketSync() {
  const queryClient = useQueryClient();
  const viewerId = useSelector((state: RootState) => state.auth.user?.id);

  useEffect(() => {
    return onMemeSendingMessage((frame) => {
      if (frame.type === 'message_received') {
        applyIncomingMessage(queryClient, frame.message, viewerId);
      } else if (frame.type === 'message_read' && viewerId) {
        // The frame reports that the *other* participant read the thread, so it's the
        // viewer's own messages that just became read.
        queryClient.setQueryData<ThreadCache>(threadKey(frame.conversation_id), (cache) =>
          markOwnMessagesRead(cache, viewerId, frame.read_at)
        );
      }
    });
  }, [queryClient, viewerId]);
}
