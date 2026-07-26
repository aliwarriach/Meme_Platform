import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import Chip from '@/components/Chip';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import TopBar from '@/components/TopBar';
import { CommunityLeaderboardRow } from '@/features/leaderboards/components/CommunityLeaderboardRow';
import { IndividualLeaderboardRow } from '@/features/leaderboards/components/IndividualLeaderboardRow';
import { useGlobalCommunityLeaderboard, useIndividualLeaderboard } from '@/services/useLeaderboards';
import type { RootState } from '@/store/store';

type Tab = 'individual' | 'communities';

export default function LeaderboardsScreen() {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('individual');

  const individualQuery = useIndividualLeaderboard();
  const communityQuery = useGlobalCommunityLeaderboard();

  const individualEntries = individualQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const communityEntries = communityQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const header = (
    <View className="mb-2 flex-row gap-2 px-6 pt-4">
      <Chip label="Individual" selected={activeTab === 'individual'} onPress={() => setActiveTab('individual')} />
      <Chip label="Communities" selected={activeTab === 'communities'} onPress={() => setActiveTab('communities')} />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Leaderboards" showBack />

      {activeTab === 'individual' ? (
        <FlatList
          data={individualEntries}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => (
            <IndividualLeaderboardRow entry={item} isViewer={item.user.id === currentUser?.id} />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 100 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (individualQuery.hasNextPage && !individualQuery.isFetchingNextPage) {
              individualQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={individualQuery.isRefetching}
              onRefresh={() => individualQuery.refetch()}
            />
          }
          ListFooterComponent={
            individualQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#e3bdc5" /> : null
          }
          ListEmptyComponent={
            individualQuery.isLoading ? (
              <ActivityIndicator className="my-8" color="#e3bdc5" />
            ) : individualQuery.isError ? (
              <Text className="mx-6 font-body text-sm text-error">{individualQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center font-body text-sm text-ink-muted">
                No scores yet — be the first to post
              </Text>
            )
          }
        />
      ) : (
        <FlatList
          data={communityEntries}
          keyExtractor={(item) => item.community_id}
          renderItem={({ item }) => <CommunityLeaderboardRow entry={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 100 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (communityQuery.hasNextPage && !communityQuery.isFetchingNextPage) {
              communityQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={communityQuery.isRefetching}
              onRefresh={() => communityQuery.refetch()}
            />
          }
          ListFooterComponent={
            communityQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#e3bdc5" /> : null
          }
          ListEmptyComponent={
            communityQuery.isLoading ? (
              <ActivityIndicator className="my-8" color="#e3bdc5" />
            ) : communityQuery.isError ? (
              <Text className="mx-6 font-body text-sm text-error">{communityQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center font-body text-sm text-ink-muted">No communities yet</Text>
            )
          }
        />
      )}

      <FloatingBottomNav active="leaderboards" />
    </SafeAreaView>
  );
}
