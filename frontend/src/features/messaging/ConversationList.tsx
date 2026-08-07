import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import type { ConversationResponse, MessageResponse } from '@/services/messaging';
import { useConversations } from '@/services/useMessaging';

export const STATUS_DOT_COLOR: Record<string, string> = {
  connected: '#5ee060',
  connecting: '#ffb1c4',
  disconnected: '#aa888f',
};

function previewOf(message: MessageResponse | null): string {
  if (!message) return 'No messages yet';
  if (message.kind === 'meme') return '📷 Meme';
  return message.body ?? '';
}

function ConversationRow({ conversation }: { conversation: ConversationResponse }) {
  const router = useRouter();
  const hasUnread = conversation.unread_count > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${conversation.other_user.username}${
        hasUnread ? `, ${conversation.unread_count} unread` : ''
      }`}
      onPress={() =>
        router.push({ pathname: '/inbox/[conversationId]', params: { conversationId: conversation.id } })
      }
      className="min-h-[44px] flex-row items-center gap-3 border-b border-outline-variant/30 px-4 py-3">
      <Avatar username={conversation.other_user.username} size="md" />

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-title text-heading" numberOfLines={1}>
            {conversation.other_user.username}
          </Text>
          {conversation.last_message_at ? (
            <Text className="font-body text-xs text-ink-muted">
              {formatDistanceToNowStrict(new Date(conversation.last_message_at), {
                addSuffix: true,
              })}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 font-body text-sm ${hasUnread ? 'text-ink' : 'text-ink-muted'}`}
            numberOfLines={1}>
            {previewOf(conversation.last_message)}
          </Text>
          {hasUnread ? (
            <View className="min-w-[20px] items-center rounded-full bg-primary px-1.5 py-0.5">
              <Text className="font-title text-xs text-bg">{conversation.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Shared conversation list — used by the mobile `/inbox` route and the desktop Feed
 * screen's always-open side panel, so the two never drift apart.
 */
export function ConversationList() {
  const { data: conversations, isLoading, isError, error, refetch, isRefetching } = useConversations();

  if (isLoading) return <ActivityIndicator className="mt-8" color="#e3bdc5" />;

  if (isError) return <Text className="px-4 pt-4 font-body text-error">{error.message}</Text>;

  if (!conversations || conversations.length === 0) {
    return (
      <Text className="px-4 pt-4 font-body text-ink-muted">
        No conversations yet — start one with a friend, or send them a meme from the feed.
      </Text>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ConversationRow conversation={item} />}
      onRefresh={refetch}
      refreshing={isRefetching}
    />
  );
}
