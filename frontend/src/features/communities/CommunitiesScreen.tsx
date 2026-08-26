import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Chip from '@/components/Chip';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import PillButton from '@/components/PillButton';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { CommunityCard } from '@/features/communities/components/CommunityCard';
import type { CommunityResponse } from '@/services/communities';
import { useDiscoverCommunities, useInvitedCommunities, useMyCommunities } from '@/services/useCommunities';

type Tab = 'mine' | 'discover' | 'pending';

export default function CommunitiesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  const mineQuery = useMyCommunities();
  const discoverQuery = useDiscoverCommunities(appliedSearch);
  const invitedQuery = useInvitedCommunities();

  const discoverCommunities: CommunityResponse[] =
    discoverQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const invitedCommunities = invitedQuery.data ?? [];

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
        <Chip
          label={invitedCommunities.length > 0 ? `Pending (${invitedCommunities.length})` : 'Pending'}
          selected={tab === 'pending'}
          onPress={() => setTab('pending')}
        />
      </View>

      {tab === 'discover' ? (
        <View className="mb-2 flex-row items-center gap-2 px-4">
          <View className="flex-1 flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2">
            <MaterialIcons name="search" size={18} color={c.inkMuted} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setAppliedSearch(searchInput)}
              placeholder="Search communities"
              placeholderTextColor={c.outline}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 py-1 font-body text-base text-heading"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search communities"
            onPress={() => setAppliedSearch(searchInput)}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
            <MaterialIcons name="search" size={18} color={c.white} />
          </Pressable>
        </View>
      ) : null}

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
      ) : tab === 'pending' ? (
        <FlatList
          data={invitedCommunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <CommunityCard community={item} onPress={() => goToCommunity(item.id)} />
          )}
          ListEmptyComponent={
            invitedQuery.isLoading ? (
              <ActivityIndicator className="mt-8" color={c.inkMuted} />
            ) : invitedQuery.isError ? (
              <Text className="font-body text-sm text-error">{invitedQuery.error?.message}</Text>
            ) : (
              <Text className="mt-8 text-center font-body text-sm text-ink-muted">
                No pending invites — communities that invite you to join will show up here
              </Text>
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
            ) : appliedSearch ? (
              <Text className="mt-8 text-center font-body text-sm text-ink-muted">
                No communities match "{appliedSearch}".
              </Text>
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
