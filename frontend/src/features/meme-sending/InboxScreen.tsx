import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import Avatar from '@/components/Avatar';
import TopBar from '@/components/TopBar';
import type { MemeSendResponse } from '@/services/memeSending';
import { useAcknowledgeSendMutation, useInbox, useReactToSendMutation } from '@/services/useMemeSending';
import type { RootState } from '@/store/store';

const QUICK_REACTIONS = ['😂', '❤️', '🔥', '😮'];

const STATUS_DOT_COLOR: Record<string, string> = {
  connected: '#5ee060',
  connecting: '#ffb1c4',
  disconnected: '#aa888f',
};

function InboxRow({ item }: { item: MemeSendResponse }) {
  const acknowledge = useAcknowledgeSendMutation();
  const react = useReactToSendMutation();

  useEffect(() => {
    if (item.status !== 'seen') acknowledge.mutate(item.id);
    // Only re-run if this specific send's id/status changes, not on every acknowledge-mutation identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.status]);

  return (
    <View className="mb-3 border-b border-outline-variant/30 pb-4">
      <View className="flex-row items-center gap-3 px-4 pb-2">
        <Avatar username={item.sender.username} size="sm" />
        <Text className="font-body text-ink">
          <Text className="font-title text-heading">{item.sender.username}</Text> sent you a meme
        </Text>
      </View>
      <Image
        source={{ uri: item.meme.image_url }}
        style={{ width: '100%', aspectRatio: 4 / 5 }}
        contentFit="cover"
      />
      {item.meme.caption ? (
        <Text className="px-4 pt-2 font-body text-ink">{item.meme.caption}</Text>
      ) : null}

      <View className="flex-row gap-2 px-4 pt-2">
        {QUICK_REACTIONS.map((emoji) => {
          const isSelected = item.reaction === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React with ${emoji}`}
              onPress={() => react.mutate({ sendId: item.id, reaction: emoji })}
              disabled={react.isPending}
              className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-full disabled:opacity-50 ${
                isSelected ? 'bg-primary/20' : ''
              }`}>
              <Text className="text-xl">{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const { data: sends, isLoading, isError, error, refetch, isRefetching } = useInbox();
  const socketStatus = useSelector((state: RootState) => state.socket.status);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Inbox"
        showBack
        rightActions={
          <View className="flex-row items-center gap-1.5">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_DOT_COLOR[socketStatus] ?? STATUS_DOT_COLOR.disconnected }}
            />
            <Text className="font-body text-xs text-ink-muted">{socketStatus}</Text>
          </View>
        }
      />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color="#e3bdc5" />
      ) : isError ? (
        <Text className="px-4 pt-4 font-body text-error">{error.message}</Text>
      ) : !sends || sends.length === 0 ? (
        <Text className="px-4 pt-4 font-body text-ink-muted">
          No memes sent to you yet — friends can send you one from any meme in the feed.
        </Text>
      ) : (
        <FlatList
          data={sends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InboxRow item={item} />}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}
