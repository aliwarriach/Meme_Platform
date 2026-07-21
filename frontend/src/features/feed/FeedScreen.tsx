import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemeCard } from '@/features/feed/components/MemeCard';
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

      <FlatList
        data={memes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MemeCard meme={item} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching}
            onRefresh={() => feedQuery.refetch()}
          />
        }
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
        }
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <ActivityIndicator className="my-8" />
          ) : feedQuery.isError ? (
            <Text className="mx-4 text-sm text-red-500">{feedQuery.error?.message}</Text>
          ) : (
            <Text className="mx-4 mt-8 text-center text-sm text-neutral-400">
              No memes yet — be the first to post
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}
