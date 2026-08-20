import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { WebLeaderboardRow } from '@/components/web/WebLeaderboardRow';
import { WebLeaderboardTabs, type LeaderboardTabKey } from '@/components/web/WebLeaderboardTabs';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useGlobalCommunityLeaderboard, useIndividualLeaderboard } from '@/services/useLeaderboards';
import type { RootState } from '@/store/store';

const TABS: { key: LeaderboardTabKey; label: string }[] = [
  { key: 'individual', label: 'Individual' },
  { key: 'communities', label: 'Communities' },
];

// Phase 2 finding (carried over from the standalone Leaderboards screen this panel was extracted
// from): neither this leaderboard nor its native counterpart ever states the ranking window on
// screen, yet a genuinely different, unwindowed number exists one screen away (the profile's
// lifetime "Snapchat Score"). A returning user has no on-screen way to tell "this resets" from
// "this only grows." Applies equally wherever this panel mounts — Leaderboards or Compete's tab.
const TAB_CONTEXT: Record<LeaderboardTabKey, string> = {
  individual: 'Ranked by activity over the last 30 days',
  communities: 'Ranked by member breadth and activity, last 30 days',
};

/**
 * The Individual/Communities toggle + both ranked lists, on Neon Plum — Vaporwave-web equivalent
 * of native `features/leaderboards/LeaderboardsPanel.tsx`. Extracted from `LeaderboardsScreen.web.tsx`
 * so `CompeteScreen.web.tsx`'s Leaderboards tab can mount the same real chrome instead of the
 * native `LeaderboardsPanel` (NativeWind classes tied to `tailwind.config.js`'s dark-only native
 * palette, wrapped in a fixed `MASTER_DARK_SURFACE` background regardless of this page's own
 * light/dark toggle — the exact "old design system still showing through" gap this component
 * closes). No `TopBar`/`FloatingBottomNav` of its own, matching the native panel's same
 * "renders identically inside the standalone `/leaderboards` route and the Compete tab" contract.
 */
export function WebLeaderboardsPanel() {
  const { colors, type, spacing } = useVaporwaveTheme();
  const [activeTab, setActiveTab] = useState<LeaderboardTabKey>('individual');
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const individualQuery = useIndividualLeaderboard();
  const communityQuery = useGlobalCommunityLeaderboard();

  const individualEntries = individualQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const communityEntries = communityQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeQuery = activeTab === 'individual' ? individualQuery : communityQuery;

  return (
    <View style={styles.root}>
      <View style={[styles.tabsWrap, { marginHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
        <WebLeaderboardTabs options={TABS} value={activeTab} onChange={setActiveTab} />
      </View>
      <Text style={[type.meta, { marginHorizontal: spacing.lg, marginBottom: spacing.md, color: colors.foregroundMuted }]}>
        {TAB_CONTEXT[activeTab]}
      </Text>

      {activeTab === 'individual' ? (
        <FlatList
          data={individualEntries}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => {
            const isViewer = item.user.id === currentUser?.id;
            return (
              <WebLeaderboardRow
                rank={item.rank}
                name={item.user.username}
                score={item.score}
                avatarUrl={item.user.avatar_url}
                isViewer={isViewer}
                accessibilityLabel={`Rank ${item.rank}, ${item.user.username}${isViewer ? ', you' : ''}, ${item.score} points`}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          style={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (individualQuery.hasNextPage && !individualQuery.isFetchingNextPage) {
              individualQuery.fetchNextPage();
            }
          }}
          ListFooterComponent={
            individualQuery.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.foregroundMuted} />
            ) : null
          }
          ListEmptyComponent={
            <PanelEmptyState query={activeQuery} emptyLabel="No scores yet — be the first to post" />
          }
        />
      ) : (
        <FlatList
          data={communityEntries}
          keyExtractor={(item) => item.community_id}
          renderItem={({ item }) => (
            <WebLeaderboardRow
              rank={item.rank}
              name={item.community_name}
              score={item.score}
              accessibilityLabel={`Rank ${item.rank}, ${item.community_name}, ${item.score} points`}
            />
          )}
          contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          style={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (communityQuery.hasNextPage && !communityQuery.isFetchingNextPage) {
              communityQuery.fetchNextPage();
            }
          }}
          ListFooterComponent={
            communityQuery.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.foregroundMuted} />
            ) : null
          }
          ListEmptyComponent={<PanelEmptyState query={activeQuery} emptyLabel="No communities yet" />}
        />
      )}
    </View>
  );
}

function PanelEmptyState({
  query,
  emptyLabel,
}: {
  query: { isLoading: boolean; isError: boolean; error: Error | null };
  emptyLabel: string;
}) {
  const { colors, type } = useVaporwaveTheme();
  if (query.isLoading) {
    return <ActivityIndicator style={{ marginTop: 32 }} color={colors.foregroundMuted} />;
  }
  if (query.isError) {
    return (
      <Text style={[type.body, { marginTop: 32, marginHorizontal: 24, color: colors.error }]}>
        {query.error?.message}
      </Text>
    );
  }
  return (
    <Text style={[type.body, { marginTop: 32, marginHorizontal: 24, textAlign: 'center', color: colors.foregroundMuted }]}>
      {emptyLabel}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  tabsWrap: {
    marginTop: 4,
  },
});
