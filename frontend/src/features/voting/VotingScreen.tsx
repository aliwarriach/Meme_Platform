import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Chip from '@/components/Chip';
import TopBar from '@/components/TopBar';
import { StandingRow } from '@/features/voting/components/StandingRow';
import { WinnerBanner } from '@/features/voting/components/WinnerBanner';
import type { CompetitionPeriodType } from '@/services/competitions';
import { useCurrentStandings, useWinner } from '@/services/useCompetitions';
import { previousPeriodKey } from '@/utils/competitionPeriods';

const TABS: { type: CompetitionPeriodType; label: string; winnerLabel: string }[] = [
  { type: 'day', label: 'Today', winnerLabel: "Yesterday's winner" },
  { type: 'week', label: 'This Week', winnerLabel: "Last week's winner" },
  { type: 'month', label: 'This Month', winnerLabel: "Last month's winner" },
];

export default function VotingScreen() {
  const [activeTab, setActiveTab] = useState<CompetitionPeriodType>('day');

  const standingsQuery = useCurrentStandings(activeTab);
  const winnerQuery = useWinner(activeTab, previousPeriodKey(activeTab), true);

  const activeTabMeta = TABS.find((tab) => tab.type === activeTab)!;

  const header = (
    <View className="pt-4">
      <View className="mb-4 flex-row gap-2 px-4">
        {TABS.map((tab) => (
          <Chip
            key={tab.type}
            label={tab.label}
            selected={activeTab === tab.type}
            onPress={() => setActiveTab(tab.type)}
          />
        ))}
      </View>

      <WinnerBanner
        winner={winnerQuery.data}
        isLoading={winnerQuery.isLoading}
        isError={winnerQuery.isError}
        label={activeTabMeta.winnerLabel}
      />

      <Text className="mb-2 mt-2 px-2 font-label text-xs uppercase tracking-wide text-ink-muted">
        Top Contenders
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Competitions" showBack />
      <FlatList
        data={standingsQuery.data?.items ?? []}
        keyExtractor={(item) =>
          item.content.kind === 'meme' ? item.content.meme.id : item.content.container.id
        }
        renderItem={({ item }) => <StandingRow entry={item} />}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={standingsQuery.isRefetching}
            onRefresh={() => standingsQuery.refetch()}
          />
        }
        ListEmptyComponent={
          standingsQuery.isLoading ? (
            <ActivityIndicator className="my-8" color="#e3bdc5" />
          ) : standingsQuery.isError ? (
            <Text className="mx-6 font-body text-sm text-error">{standingsQuery.error?.message}</Text>
          ) : (
            <Text className="mx-6 mt-8 text-center font-body text-sm text-ink-muted">
              No votes yet in this period — be the first
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}
