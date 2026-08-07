import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TopBar from '@/components/TopBar';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import { useHashtag, useHashtagFeed } from '@/services/useHashtags';

interface TagFeedScreenProps {
  slug: string;
}

export default function TagFeedScreen({ slug }: TagFeedScreenProps) {
  const router = useRouter();
  const hashtagQuery = useHashtag(slug);
  const feedQuery = useHashtagFeed(slug);

  const memes = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={`#${slug}`} showBack />

      {hashtagQuery.data?.challenge_id ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the challenge this tag enters"
          onPress={() =>
            router.push({
              pathname: '/challenges/[challengeId]',
              params: { challengeId: hashtagQuery.data!.challenge_id! },
            })
          }
          className="mx-6 mb-2 mt-3 min-h-[44px] flex-row items-center justify-between rounded-card border border-primary/40 bg-primary/10 px-4 py-3">
          <Text className="flex-1 font-body text-sm text-ink">
            🏆 Posting with #{slug} enters this challenge
          </Text>
          <Text className="font-label text-xs uppercase text-primary-dim">View</Text>
        </Pressable>
      ) : null}

      <View className="flex-1">
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
          emptyMessage={`No memes tagged #${slug} yet`}
        />
      </View>
    </SafeAreaView>
  );
}
