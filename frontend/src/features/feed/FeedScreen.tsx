import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import type { MemeResponse } from '@/services/memes';
import { useFeed } from '@/services/useMemes';

export default function FeedScreen() {
  const router = useRouter();
  const feedQuery = useFeed();

  const memes: MemeResponse[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">Feed</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new post"
          onPress={() => router.push('/new-post')}
          className="min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4">
          <Text className="text-sm font-bold text-white">New Post</Text>
        </Pressable>
      </View>

      <MemeFeedList
        memes={memes}
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
    </SafeAreaView>
  );
}
