import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { CommunityLeaderboardRow } from '@/features/leaderboards/components/CommunityLeaderboardRow';
import { IndividualLeaderboardRow } from '@/features/leaderboards/components/IndividualLeaderboardRow';
import { useGlobalCommunityLeaderboard, useIndividualLeaderboard } from '@/services/useLeaderboards';
import type { RootState } from '@/store/store';

type Tab = 'individual' | 'communities';

export default function LeaderboardsScreen() {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('individual');

  const individualQuery = useIndividualLeaderboard();
  const communityQuery = useGlobalCommunityLeaderboard();

  const individualEntries = individualQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const communityEntries = communityQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const header = (
    <View className="px-6 pt-4">
      <View className="mb-4 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
        </Pressable>
        <Text className="ml-2 text-xl font-extrabold text-neutral-900 dark:text-white">
          Leaderboards
        </Text>
      </View>

      <View className="mb-2 flex-row">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show individual leaderboard"
          onPress={() => setActiveTab('individual')}
          className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
            activeTab === 'individual'
              ? 'border-orange-500 bg-orange-500'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}>
          <Text
            className={
              activeTab === 'individual' ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
            }>
            Individual
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show community leaderboard"
          onPress={() => setActiveTab('communities')}
          className={`min-h-[44px] items-center justify-center rounded-xl border px-4 ${
            activeTab === 'communities'
              ? 'border-orange-500 bg-orange-500'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}>
          <Text
            className={
              activeTab === 'communities' ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
            }>
            Communities
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      {activeTab === 'individual' ? (
        <FlatList
          data={individualEntries}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => (
            <IndividualLeaderboardRow entry={item} isViewer={item.user.id === currentUser?.id} />
          )}
          ListHeaderComponent={header}
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
            individualQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
          ListEmptyComponent={
            individualQuery.isLoading ? (
              <ActivityIndicator className="my-8" />
            ) : individualQuery.isError ? (
              <Text className="mx-6 text-sm text-red-500">{individualQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center text-sm text-neutral-400">
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
            communityQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
          ListEmptyComponent={
            communityQuery.isLoading ? (
              <ActivityIndicator className="my-8" />
            ) : communityQuery.isError ? (
              <Text className="mx-6 text-sm text-red-500">{communityQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center text-sm text-neutral-400">
                No communities yet
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
