import { MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { NotificationResponse, NotificationType } from '@/services/notifications';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotifications,
} from '@/services/useNotifications';

const ICON_BY_TYPE: Record<NotificationType, keyof typeof MaterialIcons.glyphMap> = {
  challenge_invite: 'sports-kabaddi',
  challenge_invite_accepted: 'check-circle-outline',
  challenge_invite_declined: 'cancel',
  challenge_starting: 'flag-circle',
  challenge_ending_soon: 'timer',
  challenge_side_overtaken: 'trending-up',
  challenge_results: 'emoji-events',
  friend_request_received: 'person-add',
  friend_request_accepted: 'how-to-reg',
  community_join_request: 'group-add',
  community_join_approved: 'check-circle-outline',
  community_join_rejected: 'cancel',
  community_post_removed: 'delete-outline',
  meme_comment_received: 'chat-bubble-outline',
  meme_upvotes_received: 'thumb-up',
  competition_won: 'emoji-events',
};

function NotificationRow({ notification }: { notification: NotificationResponse }) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const markRead = useMarkNotificationReadMutation();
  const isUnread = notification.read_at === null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      onPress={() => {
        if (isUnread) markRead.mutate(notification.id);
        if (notification.data.challenge_id) {
          router.push({
            pathname: '/challenges/[challengeId]',
            params: { challengeId: notification.data.challenge_id },
          });
        } else if (notification.data.conversation_id) {
          router.push({
            pathname: '/inbox/[conversationId]',
            params: { conversationId: notification.data.conversation_id },
          });
        } else if (notification.data.meme_id) {
          router.push({ pathname: '/memes/[id]', params: { id: notification.data.meme_id } });
        } else if (notification.data.community_id) {
          router.push({
            pathname: '/communities/[id]',
            params: {
              id: notification.data.community_id,
              // A new join request needs the owner looking at the requests list, not the
              // community's default Feed tab — everything else community-related (approved/
              // rejected/post-removed) is purely informational and the default tab is fine.
              ...(notification.type === 'community_join_request'
                ? { tab: 'members', openRequests: '1' }
                : {}),
            },
          });
        } else if (notification.data.friendship_id) {
          router.push('/friends');
        } else if (notification.data.period_type) {
          router.push({
            pathname: '/voting',
            params: { period: notification.data.period_type },
          });
        }
      }}
      className={`min-h-[44px] flex-row items-start gap-3 border-b border-outline-variant/30 px-4 py-3 ${
        isUnread ? 'bg-surface' : ''
      }`}>
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-surface-high">
        <MaterialIcons name={ICON_BY_TYPE[notification.type]} size={18} color={c.inkMuted} />
      </View>
      <View className="flex-1">
        <Text className={`font-title text-heading ${isUnread ? '' : 'text-ink-muted'}`}>
          {notification.title}
        </Text>
        <Text className="font-body text-sm text-ink-muted" numberOfLines={2}>
          {notification.body}
        </Text>
        <Text className="mt-1 font-body text-xs text-ink-muted">
          {formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })}
        </Text>
      </View>
      {isUnread ? <View className="mt-2 h-2 w-2 rounded-full bg-primary" /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const notificationsQuery = useNotifications();
  const markAllRead = useMarkAllNotificationsReadMutation();

  const items = notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = items.some((n) => n.read_at === null);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Notifications"
        showBack
        rightActions={
          hasUnread ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              onPress={() => markAllRead.mutate()}
              className="h-11 items-center justify-center px-2">
              <Text className="font-label text-xs uppercase text-primary-dim">Mark all read</Text>
            </Pressable>
          ) : null
        }
      />

      {notificationsQuery.isLoading ? (
        <ActivityIndicator className="mt-8" color={c.inkMuted} />
      ) : notificationsQuery.isError ? (
        <Text className="px-4 pt-4 font-body text-error">{notificationsQuery.error?.message}</Text>
      ) : items.length === 0 ? (
        <Text className="px-4 pt-4 font-body text-ink-muted">
          Nothing yet — friend requests, community activity, comments, and challenge/contest
          updates will show up here.
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          onEndReached={() => {
            if (notificationsQuery.hasNextPage) notificationsQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          onRefresh={() => notificationsQuery.refetch()}
          refreshing={notificationsQuery.isRefetching}
          ListFooterComponent={
            notificationsQuery.isFetchingNextPage ? (
              <ActivityIndicator className="my-4" color={c.inkMuted} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
