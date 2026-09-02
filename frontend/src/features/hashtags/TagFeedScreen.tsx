import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/SegmentedControl';
import TopBar from '@/components/TopBar';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import { ChallengeRaceHeader } from '@/features/hashtags/components/ChallengeRaceHeader';
import { ChallengeResultCard } from '@/features/hashtags/components/ChallengeResultCard';
import { useHashtag, useHashtagFeed } from '@/services/useHashtags';

interface TagFeedScreenProps {
  slug: string;
}

type SortMode = 'hot' | 'latest';

const SORT_OPTIONS = [
  { key: 'hot' as const, label: 'Hot' },
  { key: 'latest' as const, label: 'Latest' },
];

export default function TagFeedScreen({ slug }: TagFeedScreenProps) {
  const [sort, setSort] = useState<SortMode>('hot');
  const hashtagQuery = useHashtag(slug);
  const feedQuery = useHashtagFeed(slug, sort);

  const memes = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeChallenge = hashtagQuery.data?.active_challenge;
  const recentResultChallenge = hashtagQuery.data?.recent_result_challenge;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={`#${slug}`} showBack />

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
          ListHeaderComponent={
            <View>
              {/* Live race always renders above the result card — explicit product
                  decision (Roadmap_Search.md §1.4): reservations release on evaluation, so
                  a new challenge can claim this tag while its predecessor is still inside
                  its 24h result window. */}
              {activeChallenge ? <ChallengeRaceHeader challenge={activeChallenge} /> : null}
              {recentResultChallenge ? (
                <ChallengeResultCard challenge={recentResultChallenge} />
              ) : null}
              <View className="mx-4 mt-3">
                <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={setSort} />
              </View>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
