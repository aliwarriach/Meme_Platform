import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MergedFeedList } from '@/features/feed/components/MemeFeedList';
import { ShareInstagramLinkModal } from '@/features/instagram-companion/ShareInstagramLinkModal';
import type { MergedFeedItem } from '@/services/memes';
import { useFeed } from '@/services/useMemes';

export default function FeedScreen() {
  const router = useRouter();
  const feedQuery = useFeed();
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const items: MergedFeedItem[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">Feed</Text>
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share an Instagram Reel"
            onPress={() => setShareModalVisible(true)}
            className="mr-2 min-h-[44px] items-center justify-center rounded-xl border border-neutral-300 px-4 dark:border-neutral-700">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">Share Reel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a new post"
            onPress={() => router.push('/new-post')}
            className="min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4">
            <Text className="text-sm font-bold text-white">New Post</Text>
          </Pressable>
        </View>
      </View>

      <MergedFeedList
        items={items}
        isLoading={feedQuery.isLoading}
        isError={feedQuery.isError}
        errorMessage={feedQuery.error?.message}
        hasNextPage={feedQuery.hasNextPage}
        isFetchingNextPage={feedQuery.isFetchingNextPage}
        onEndReached={() => feedQuery.fetchNextPage()}
        isRefetching={feedQuery.isRefetching}
        onRefresh={() => feedQuery.refetch()}
        emptyMessage="No memes yet — be the first to post"
      />

      <ShareInstagramLinkModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
      />
    </SafeAreaView>
  );
}
