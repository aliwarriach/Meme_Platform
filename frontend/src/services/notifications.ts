import { api } from '@/services/api';

export type NotificationType =
  | 'challenge_invite'
  | 'challenge_invite_accepted'
  | 'challenge_invite_declined'
  | 'challenge_starting'
  | 'challenge_ending_soon'
  | 'challenge_side_overtaken'
  | 'challenge_results';

export interface NotificationData {
  challenge_id?: string;
  conversation_id?: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPageResponse {
  items: NotificationResponse[];
  next_cursor: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkAllReadResponse {
  read_count: number;
}

export function listNotificationsRequest(cursor: string | null, limit = 30) {
  return api.get<NotificationPageResponse>('/notifications', {
    limit,
    ...(cursor ? { cursor } : {}),
  });
}

export function unreadNotificationCountRequest() {
  return api.get<UnreadCountResponse>('/notifications/unread-count');
}

export function markNotificationReadRequest(notificationId: string) {
  return api.post<NotificationResponse>(`/notifications/${notificationId}/read`);
}

export function markAllNotificationsReadRequest() {
  return api.post<MarkAllReadResponse>('/notifications/read-all');
}

export function registerPushTokenRequest(token: string, platform: string) {
  return api.post<void>('/notifications/push-token', { token, platform });
}

export function unregisterPushTokenRequest(token: string) {
  return api.delete<void>('/notifications/push-token', { token });
}
