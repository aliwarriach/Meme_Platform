import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import type { MemeSendResponse } from '@/services/memeSending';
import { useAcknowledgeSendMutation, useInbox, useReactToSendMutation } from '@/services/useMemeSending';
import type { RootState } from '@/store/store';

const QUICK_REACTIONS = ['😂', '❤️', '🔥', '😮'];

function InboxRow({ item }: { item: MemeSendResponse }) {
  const acknowledge = useAcknowledgeSendMutation();
  const react = useReactToSendMutation();

  useEffect(() => {
    if (item.status !== 'seen') acknowledge.mutate(item.id);
    // Only re-run if this specific send's id/status changes, not on every acknowledge-mutation identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.status]);

  return (
    <View className="mb-4 border-b border-neutral-100 pb-4 dark:border-neutral-800">
      <Text className="px-4 pb-2 text-neutral-900 dark:text-white">
        <Text className="font-semibold">{item.sender.username}</Text> sent you a meme
      </Text>
      <Image
        source={{ uri: item.meme.image_url }}
        style={{ width: '100%', aspectRatio: 1 }}
        contentFit="cover"
      />
      {item.meme.caption ? (
        <Text className="px-4 pt-2 text-neutral-900 dark:text-neutral-100">
          {item.meme.caption}
        </Text>
      ) : null}

      <View className="flex-row px-4 pt-2">
        {QUICK_REACTIONS.map((emoji) => {
          const isSelected = item.reaction === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React with ${emoji}`}
              onPress={() => react.mutate({ sendId: item.id, reaction: emoji })}
              disabled={react.isPending}
              className="mr-3 min-h-[44px] min-w-[44px] items-center justify-center rounded-full disabled:opacity-50"
              style={{ backgroundColor: isSelected ? 'rgba(249,115,22,0.15)' : 'transparent' }}>
              <Text className="text-xl">{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { data: sends, isLoading, isError, error, refetch, isRefetching } = useInbox();
  const socketStatus = useSelector((state: RootState) => state.socket.status);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center">
          <Text className="text-neutral-900 dark:text-white">← Back</Text>
        </Pressable>
        <Text className="text-lg font-bold text-neutral-900 dark:text-white">Inbox</Text>
        <View className="flex-row items-center">
          <View
            className="mr-1.5 h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                socketStatus === 'connected'
                  ? '#22c55e'
                  : socketStatus === 'connecting'
                    ? '#eab308'
                    : '#9ca3af',
            }}
          />
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{socketStatus}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : isError ? (
        <Text className="px-4 pt-4 text-red-500">{error.message}</Text>
      ) : !sends || sends.length === 0 ? (
        <Text className="px-4 pt-4 text-neutral-500 dark:text-neutral-400">
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
