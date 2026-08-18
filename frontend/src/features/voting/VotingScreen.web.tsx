import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebCompetitionEntryModal } from '@/components/web/WebCompetitionEntryModal';
import { WebStandingRow } from '@/components/web/WebStandingRow';
import WebVotingTopBar from '@/components/web/WebVotingTopBar';
import { WebVotingTabs } from '@/components/web/WebVotingTabs';
import { WebWinnerBanner } from '@/components/web/WebWinnerBanner';
import { VotingThemeProvider, useVotingWebTheme } from '@/constants/VotingWebTheme';
import { injectVotingWebFont, VOTING_WEB_SPACING, VOTING_WEB_TYPE } from '@/constants/webVotingTheme';
import type { CompetitionPeriodType, StandingContent } from '@/services/competitions';
import { useCurrentStandings, useWinner } from '@/services/useCompetitions';
import { previousPeriodKey } from '@/utils/competitionPeriods';

const TABS: { type: CompetitionPeriodType; label: string; winnerLabel: string }[] = [
  { type: 'day', label: 'Today', winnerLabel: "Yesterday's winner" },
  { type: 'week', label: 'This Week', winnerLabel: "Last week's winner" },
  { type: 'month', label: 'This Month', winnerLabel: "Last month's winner" },
];

/**
 * Web-only sibling of `features/voting/VotingScreen.tsx` (native-resolved, untouched — Expo
 * Router's platform-extension resolution prefers this file for every web bundle, `app/voting.tsx`
 * needs zero changes). RESKIN-mode pass, page-scoped to
 * `design-system/meme-platform/pages/voting-web.md` — restyles the existing tabs / winner banner
 * / standings list structure rather than rebuilding it; see that file and this agent's final
 * report for the full skill-query convergence and the two real UX additions this pass made (top-3
 * rank emphasis, live/final period badge).
 */
function VotingScreenContent() {
  const { colors } = useVotingWebTheme();
  const [activeTab, setActiveTab] = useState<CompetitionPeriodType>('day');
  const [selectedContent, setSelectedContent] = useState<StandingContent | null>(null);

  const standingsQuery = useCurrentStandings(activeTab);
  const winnerQuery = useWinner(activeTab, previousPeriodKey(activeTab), true);

  const activeTabMeta = TABS.find((tab) => tab.type === activeTab)!;
  const items = standingsQuery.data?.items ?? [];

  useEffect(() => {
    injectVotingWebFont();
  }, []);

  // Surfaces `StandingsPageResponse.is_closed` — returned by the API today but never rendered by
  // the native screen. Real UX gap: with no snapshot (standings are live-computed, per
  // voting-system.md), a viewer has no way to tell "this ranking can still change" from "this
  // period is decided" apart from this field. Small, additive, low-risk (existing field, no new
  // fetch), directly serves the primary action of trusting what "seeing standings" means.
  //
  // "Live" is a SOLID `primary`-fill pill with `onPrimary` text (matches the conventional
  // solid-red "LIVE" badge used across streaming/sports apps — a real, not decorative, use of
  // this pass's energetic accent) — verified 4.70:1. "Final" is a neutral outline pill
  // (transparent + `border` + `foreground` text) rather than a tinted fill, since `foregroundMuted`
  // measured under 4.5:1 AA against every tinted-fill option tried in light mode (see
  // webVotingTheme.ts) — `foreground` on the plain page background clears it easily.
  const periodStatusBadge = standingsQuery.data ? (
    standingsQuery.data.is_closed ? (
      <View style={[styles.statusBadge, styles.statusBadgeOutline, { borderColor: colors.border }]}>
        <Text style={[VOTING_WEB_TYPE.label, { color: colors.foreground }]}>Final</Text>
      </View>
    ) : (
      <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
        <View style={[styles.statusDot, { backgroundColor: colors.onPrimary }]} />
        <Text style={[VOTING_WEB_TYPE.label, { color: colors.onPrimary }]}>Live</Text>
      </View>
    )
  ) : null;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.tabsWrap}>
        <WebVotingTabs options={TABS} value={activeTab} onChange={setActiveTab} />
      </View>

      <WebWinnerBanner
        winner={winnerQuery.data}
        isLoading={winnerQuery.isLoading}
        isError={winnerQuery.isError}
        errorMessage={winnerQuery.error?.message}
        label={activeTabMeta.winnerLabel}
        onPress={setSelectedContent}
      />

      <View style={styles.sectionRow}>
        <Text style={[VOTING_WEB_TYPE.label, { color: colors.foregroundMuted }]}>Top Contenders</Text>
        {periodStatusBadge}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebVotingTopBar title="Competitions" />

        <FlatList
          data={items}
          keyExtractor={(item) => (item.content.kind === 'meme' ? item.content.meme.id : item.content.container.id)}
          renderItem={({ item }) => <WebStandingRow entry={item} onPress={setSelectedContent} />}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            standingsQuery.isLoading ? (
              <ActivityIndicator style={styles.emptyPad} color={colors.foregroundMuted} />
            ) : standingsQuery.isError ? (
              <Text style={[VOTING_WEB_TYPE.body, styles.emptyPad, { color: colors.destructive }]}>
                {standingsQuery.error?.message}
              </Text>
            ) : (
              <Text style={[VOTING_WEB_TYPE.body, styles.emptyPad, { color: colors.foregroundMuted, textAlign: 'center' }]}>
                No votes yet in this period — be the first
              </Text>
            )
          }
        />
      </SafeAreaView>

      <WebCompetitionEntryModal content={selectedContent} onClose={() => setSelectedContent(null)} />
    </View>
  );
}

export default function VotingScreen() {
  return (
    <VotingThemeProvider>
      <VotingScreenContent />
    </VotingThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  listContent: {
    paddingBottom: VOTING_WEB_SPACING.xxl,
  },
  headerBlock: {
    paddingTop: VOTING_WEB_SPACING.lg,
  },
  tabsWrap: {
    marginBottom: VOTING_WEB_SPACING.lg,
    marginHorizontal: VOTING_WEB_SPACING.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: VOTING_WEB_SPACING.lg,
    marginBottom: VOTING_WEB_SPACING.sm,
    marginTop: VOTING_WEB_SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: VOTING_WEB_SPACING.sm,
    paddingVertical: 4,
  },
  statusBadgeOutline: {
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyPad: {
    marginTop: VOTING_WEB_SPACING.xxl,
    marginHorizontal: VOTING_WEB_SPACING.lg,
  },
});
