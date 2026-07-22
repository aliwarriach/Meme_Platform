import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { StandingRow } from '@/features/voting/components/StandingRow';
import { WinnerBanner } from '@/features/voting/components/WinnerBanner';
import type { CompetitionPeriodType } from '@/services/competitions';
import { useCastVoteMutation, useCurrentStandings, useWinner } from '@/services/useCompetitions';
import type { RootState } from '@/store/store';
import { previousPeriodKey } from '@/utils/competitionPeriods';

const TABS: { type: CompetitionPeriodType; label: string; winnerLabel: string }[] = [
  { type: 'day', label: 'Today', winnerLabel: "Yesterday's winner" },
  { type: 'week', label: 'This Week', winnerLabel: "Last week's winner" },
  { type: 'month', label: 'This Month', winnerLabel: "Last month's winner" },
];

export default function VotingScreen() {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<CompetitionPeriodType>('day');

  const standingsQuery = useCurrentStandings(activeTab);
  const castVote = useCastVoteMutation(activeTab);
  const winnerQuery = useWinner(activeTab, previousPeriodKey(activeTab), true);

  const activeTabMeta = TABS.find((tab) => tab.type === activeTab)!;

  const header = (
    <View className="px-4 pt-4">
      <View className="mb-4 flex-row items-center px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
        </Pressable>
        <Text className="ml-2 text-xl font-extrabold text-neutral-900 dark:text-white">
          Meme of the Day/Week/Month
        </Text>
      </View>

      <View className="mb-4 flex-row px-2">
        {TABS.map((tab) => (
          <Pressable
            key={tab.type}
            accessibilityRole="button"
            accessibilityLabel={`Show ${tab.label} competition`}
            onPress={() => setActiveTab(tab.type)}
            className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
              activeTab === tab.type
                ? 'border-orange-500 bg-orange-500'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}>
            <Text
              className={
                activeTab === tab.type ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
              }>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <WinnerBanner
        winner={winnerQuery.data}
        isLoading={winnerQuery.isLoading}
        isError={winnerQuery.isError}
        label={activeTabMeta.winnerLabel}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <FlatList
        data={standingsQuery.data?.items ?? []}
        keyExtractor={(item) => item.meme.id}
        renderItem={({ item }) => (
          <StandingRow
            entry={item}
            onVote={() => castVote.mutate(item.meme.id)}
            isVoting={castVote.isPending && castVote.variables === item.meme.id}
            isOwnMeme={item.meme.author.id === currentUser?.id}
          />
        )}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={standingsQuery.isRefetching}
            onRefresh={() => standingsQuery.refetch()}
          />
        }
        ListEmptyComponent={
          standingsQuery.isLoading ? (
            <ActivityIndicator className="my-8" />
          ) : standingsQuery.isError ? (
            <Text className="mx-6 text-sm text-red-500">{standingsQuery.error?.message}</Text>
          ) : (
            <Text className="mx-6 mt-8 text-center text-sm text-neutral-400">
              No votes yet in this period — be the first
            </Text>
          )
        }
      />
      {castVote.isError ? (
        <Text className="mx-6 mb-2 text-center text-sm text-red-500">
          {castVote.error?.message}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
