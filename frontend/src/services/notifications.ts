import { api } from '@/services/api';

export type NotificationType =
  | 'challenge_invite'
  | 'challenge_invite_accepted'
  | 'challenge_invite_declined'
  | 'challenge_starting'
  | 'challenge_ending_soon'
  | 'challenge_side_overtaken'
  | 'challenge_results'
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'community_join_request'
  | 'community_join_approved'
  | 'community_join_rejected'
  | 'community_post_removed'
  | 'meme_comment_received'
  | 'meme_upvotes_received'
  | 'competition_won';

export interface NotificationData {
  challenge_id?: string;
  conversation_id?: string;
  friendship_id?: string;
  community_id?: string;
  meme_id?: string;
  period_type?: 'day' | 'week' | 'month';
  period_key?: string;
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
