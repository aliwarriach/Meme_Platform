import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { WebLeaderboardRow } from '@/components/web/WebLeaderboardRow';
import { WebLeaderboardTabs, type LeaderboardTabKey } from '@/components/web/WebLeaderboardTabs';
import WebLeaderboardsTopBar from '@/components/web/WebLeaderboardsTopBar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useGlobalCommunityLeaderboard, useIndividualLeaderboard } from '@/services/useLeaderboards';
import type { RootState } from '@/store/store';

const TABS: { key: LeaderboardTabKey; label: string }[] = [
  { key: 'individual', label: 'Individual' },
  { key: 'communities', label: 'Communities' },
];

// Phase 2 finding: neither this leaderboard nor its native counterpart ever states the ranking
// window on screen, yet a genuinely different, unwindowed number exists one screen away (the
// profile's lifetime "Snapchat Score" — see .claude/memory/leaderboards.md). A returning user
// has no on-screen way to tell "this resets" from "this only grows." One line per tab closes
// that gap without adding a new element to the page's structure.
const TAB_CONTEXT: Record<LeaderboardTabKey, string> = {
  individual: 'Ranked by activity over the last 30 days',
  communities: 'Ranked by member breadth and activity, last 30 days',
};

/**
 * Web-only sibling of `features/leaderboards/LeaderboardsScreen.tsx` (native-resolved, byte-for-
 * byte untouched — Expo Router's platform-extension resolution prefers this file for the web
 * bundle, `app/leaderboards.tsx` needs zero changes). Net-new build directly on the project's
 * standing Vaporwave/Luminous system — there is no prior independent web theme to retire here
 * (unlike Voting/Challenges) — see `design-system/meme-platform/pages/leaderboard-web.md` for
 * the full record.
 *
 * Structure follows `VotingScreen.web.tsx`'s own pattern (closest analog: another standalone,
 * no-bottom-nav, ranked-list screen) — segmented tabs + `FlatList`, not the winner-banner
 * treatment, since Leaderboards has no "settled past period" concept to separate out.
 */
function LeaderboardsScreenContent() {
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const [activeTab, setActiveTab] = useState<LeaderboardTabKey>('individual');
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const individualQuery = useIndividualLeaderboard();
  const communityQuery = useGlobalCommunityLeaderboard();

  const individualEntries = individualQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const communityEntries = communityQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const activeQuery = activeTab === 'individual' ? individualQuery : communityQuery;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebLeaderboardsTopBar title="Leaderboards" />

        <View style={styles.headerBlock}>
          <View style={styles.tabsWrap}>
            <WebLeaderboardTabs options={TABS} value={activeTab} onChange={setActiveTab} />
          </View>
          <Text style={[type.meta, styles.contextLine, { color: colors.foregroundMuted }]}>
            {TAB_CONTEXT[activeTab]}
          </Text>
        </View>

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
            contentContainerStyle={styles.listContent}
            style={styles.list}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (individualQuery.hasNextPage && !individualQuery.isFetchingNextPage) {
                individualQuery.fetchNextPage();
              }
            }}
            ListFooterComponent={
              individualQuery.isFetchingNextPage ? (
                <ActivityIndicator style={styles.footerPad} color={colors.foregroundMuted} />
              ) : null
            }
            ListEmptyComponent={<LeaderboardEmptyState query={activeQuery} emptyLabel="No scores yet — be the first to post" />}
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
            contentContainerStyle={styles.listContent}
            style={styles.list}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (communityQuery.hasNextPage && !communityQuery.isFetchingNextPage) {
                communityQuery.fetchNextPage();
              }
            }}
            ListFooterComponent={
              communityQuery.isFetchingNextPage ? (
                <ActivityIndicator style={styles.footerPad} color={colors.foregroundMuted} />
              ) : null
            }
            ListEmptyComponent={<LeaderboardEmptyState query={activeQuery} emptyLabel="No communities yet" />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function LeaderboardEmptyState({
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

export default function LeaderboardsScreen() {
  return (
    <VaporwaveThemeProvider>
      <LeaderboardsScreenContent />
    </VaporwaveThemeProvider>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    safe: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing.xxl,
      paddingTop: spacing.sm,
    },
    headerBlock: {
      paddingTop: spacing.lg,
    },
    tabsWrap: {
      marginBottom: spacing.sm,
      marginHorizontal: spacing.lg,
    },
    contextLine: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    footerPad: {
      marginVertical: spacing.lg,
    },
  });
