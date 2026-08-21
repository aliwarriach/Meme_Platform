import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Chip from '@/components/Chip';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import PillButton from '@/components/PillButton';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { CommunityCard } from '@/features/communities/components/CommunityCard';
import type { CommunityResponse } from '@/services/communities';
import { useDiscoverCommunities, useMyCommunities } from '@/services/useCommunities';

type Tab = 'mine' | 'discover';

export default function CommunitiesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  const mineQuery = useMyCommunities();
  const discoverQuery = useDiscoverCommunities();

  const discoverCommunities: CommunityResponse[] =
    discoverQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const goToCommunity = (id: string) =>
    router.push({ pathname: '/communities/[id]', params: { id } });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Communities"
        rightActions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a community"
            onPress={() => router.push('/communities/new')}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="add-circle-outline" size={24} color={c.heading} />
          </Pressable>
        }
      />

      <View className="mb-2 flex-row gap-2 px-4 pt-3">
        <Chip label="My Communities" selected={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip label="Discover" selected={tab === 'discover'} onPress={() => setTab('discover')} />
      </View>

      {tab === 'mine' ? (
        <FlatList
          data={mineQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <CommunityCard community={item} onPress={() => goToCommunity(item.id)} />
          )}
          ListEmptyComponent={
            mineQuery.isLoading ? (
              <ActivityIndicator className="mt-8" color={c.inkMuted} />
            ) : mineQuery.isError ? (
              <Text className="font-body text-sm text-error">{mineQuery.error?.message}</Text>
            ) : (
              <View className="mt-8 items-center gap-3 px-6">
                <Text className="text-center font-body text-sm text-ink-muted">
                  You haven&apos;t joined any communities yet
                </Text>
                <PillButton
                  label="Discover Communities"
                  variant="outline"
                  onPress={() => setTab('discover')}
                />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={discoverCommunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
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
            discoverQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color={c.inkMuted} /> : null
          }
          ListEmptyComponent={
            discoverQuery.isLoading ? (
              <ActivityIndicator className="mt-8" color={c.inkMuted} />
            ) : discoverQuery.isError ? (
              <Text className="font-body text-sm text-error">{discoverQuery.error?.message}</Text>
            ) : (
              <Text className="mt-8 text-center font-body text-sm text-ink-muted">
                No communities yet — be the first to create one
              </Text>
            )
          }
        />
      )}

      <FloatingBottomNav active="communities" />
    </SafeAreaView>
  );
}
