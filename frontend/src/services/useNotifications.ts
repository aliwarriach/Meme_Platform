import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import { onMemeSendingMessage } from '@/services/memeSendingSocket';
import {
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  registerPushTokenRequest,
  unreadNotificationCountRequest,
  unregisterPushTokenRequest,
  type MarkAllReadResponse,
  type NotificationPageResponse,
  type NotificationResponse,
  type UnreadCountResponse,
} from '@/services/notifications';
import {
  insertNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationsCache,
} from '@/services/notificationsCache';

const notificationsKey = ['notifications', 'list'] as const;
const unreadCountKey = ['notifications', 'unreadCount'] as const;

export function useNotifications() {
  return useInfiniteQuery<NotificationPageResponse, Error>({
    queryKey: notificationsKey,
    queryFn: async ({ pageParam }) => {
      const response = await listNotificationsRequest(pageParam as string | null);
      if (!response.ok || !response.data) throwApiError(response, 'load notifications');
      return response.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

export function useUnreadNotificationCount() {
  return useQuery<UnreadCountResponse, Error>({
    queryKey: unreadCountKey,
    queryFn: async () => {
      const response = await unreadNotificationCountRequest();
      if (!response.ok || !response.data) throwApiError(response, 'load unread count');
      return response.data;
    },
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation<NotificationResponse, Error, string>({
    mutationFn: async (notificationId) => {
      const response = await markNotificationReadRequest(notificationId);
      if (!response.ok || !response.data) throwApiError(response, 'mark notification read');
      return response.data;
    },
    onMutate: async (notificationId) => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationsCache>(notificationsKey, (cache) =>
        markNotificationRead(cache, notificationId, readAt)
      );
      queryClient.setQueryData<UnreadCountResponse>(unreadCountKey, (current) =>
        current ? { count: Math.max(0, current.count - 1) } : current
      );
    },
    onError: () => {
      // A failed mark-read is rare and low-stakes — resync both caches from the server
      // rather than trying to precisely roll back an optimistic decrement.
      queryClient.invalidateQueries({ queryKey: notificationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation<MarkAllReadResponse, Error, void>({
    mutationFn: async () => {
      const response = await markAllNotificationsReadRequest();
      if (!response.ok || !response.data) throwApiError(response, 'mark all notifications read');
      return response.data;
    },
    onMutate: async () => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationsCache>(notificationsKey, (cache) =>
        markAllNotificationsRead(cache, readAt)
      );
      queryClient.setQueryData<UnreadCountResponse>(unreadCountKey, { count: 0 });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
}

export function useRegisterPushTokenMutation() {
  return useMutation<void, Error, { token: string; platform: string }>({
    mutationFn: async ({ token, platform }) => {
      const response = await registerPushTokenRequest(token, platform);
      if (!response.ok) throwApiError(response, 'register push token');
    },
  });
}

export function useUnregisterPushTokenMutation() {
  return useMutation<void, Error, string>({
    mutationFn: async (token) => {
      const response = await unregisterPushTokenRequest(token);
      if (!response.ok) throwApiError(response, 'unregister push token');
    },
  });
}

/**
 * Applies live `notification` socket frames to the notification-centre caches. Mounted
 * once at the app root (`_layout.tsx`), not per screen — the bell badge has to stay
 * current while the user is anywhere else in the app, same as `useMessagingSocketSync`.
 */
export function useNotificationsSocketSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onMemeSendingMessage((frame) => {
      if (frame.type !== 'notification') return;
      queryClient.setQueryData<NotificationsCache>(notificationsKey, (cache) =>
        insertNotification(cache, frame.notification)
      );
      queryClient.setQueryData<UnreadCountResponse>(unreadCountKey, (current) => ({
        count: (current?.count ?? 0) + 1,
      }));
    });
  }, [queryClient]);
}
