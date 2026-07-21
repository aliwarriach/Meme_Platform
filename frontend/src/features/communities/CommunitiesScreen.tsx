import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityCard } from '@/features/communities/components/CommunityCard';
import type { CommunityResponse } from '@/services/communities';
import { useDiscoverCommunities, useMyCommunities } from '@/services/useCommunities';

type Tab = 'mine' | 'discover';

export default function CommunitiesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');

  const mineQuery = useMyCommunities();
  const discoverQuery = useDiscoverCommunities();

  const discoverCommunities: CommunityResponse[] =
    discoverQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const goToCommunity = (id: string) =>
    router.push({ pathname: '/communities/[id]', params: { id } });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">
          Communities
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a community"
          onPress={() => router.push('/communities/new')}
          className="min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4">
          <Text className="text-sm font-bold text-white">Create</Text>
        </Pressable>
      </View>

      <View className="mb-2 flex-row px-4">
        {(['mine', 'discover'] as Tab[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={value === 'mine' ? 'My Communities tab' : 'Discover tab'}
            onPress={() => setTab(value)}
            className={`mr-2 min-h-[40px] items-center justify-center rounded-xl px-4 ${
              tab === value ? 'bg-orange-500' : 'bg-neutral-100 dark:bg-neutral-900'
            }`}>
            <Text
              className={
                tab === value ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
              }>
              {value === 'mine' ? 'My Communities' : 'Discover'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'mine' ? (
        <FlatList
          data={mineQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => (
            <CommunityCard community={item} onPress={() => goToCommunity(item.id)} />
          )}
          ListEmptyComponent={
            mineQuery.isLoading ? (
              <ActivityIndicator className="mt-8" />
            ) : mineQuery.isError ? (
              <Text className="text-sm text-red-500">{mineQuery.error?.message}</Text>
            ) : (
              <Text className="mt-8 text-center text-sm text-neutral-400">
                You haven&apos;t joined any communities yet
              </Text>
            )
          }
        />
      ) : (
        <FlatList
          data={discoverCommunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
              discoverQuery.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <CommunityCard community={item} onPress={() => goToCommunity(item.id)} />
          )}
          ListFooterComponent={
            discoverQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
          ListEmptyComponent={
            discoverQuery.isLoading ? (
              <ActivityIndicator className="mt-8" />
            ) : discoverQuery.isError ? (
              <Text className="text-sm text-red-500">{discoverQuery.error?.message}</Text>
            ) : (
              <Text className="mt-8 text-center text-sm text-neutral-400">
                No communities yet — be the first to create one
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
