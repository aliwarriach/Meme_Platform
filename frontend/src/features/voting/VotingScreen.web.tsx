import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebCompetitionEntryModal } from '@/components/web/WebCompetitionEntryModal';
import { WebStandingRow } from '@/components/web/WebStandingRow';
import WebVotingTopBar from '@/components/web/WebVotingTopBar';
import { WebVotingTabs } from '@/components/web/WebVotingTabs';
import { WebWinnerBanner } from '@/components/web/WebWinnerBanner';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { CompetitionPeriodType, StandingContent } from '@/services/competitions';
import { useCurrentStandings, useWinner } from '@/services/useCompetitions';
import { previousPeriodKey } from '@/utils/competitionPeriods';

const TABS: { type: CompetitionPeriodType; label: string; winnerLabel: string }[] = [
  { type: 'day', label: 'Today', winnerLabel: "Yesterday's winner" },
  { type: 'week', label: 'This Week', winnerLabel: "Last week's winner" },
  { type: 'month', label: 'This Month', winnerLabel: "Last month's winner" },
];

/**
 * Web-only sibling of `features/voting/VotingScreen.tsx` (native-resolved, byte-for-byte
 * untouched — Expo Router's platform-extension resolution prefers this file for every web
 * bundle, `app/voting.tsx` needs zero changes). Migrated off the retired independent
 * `webVotingTheme.ts`/`VotingWebTheme.tsx` system onto the Vaporwave/Luminous glass system now
 * standard for this project's web rendering — see `design-system/meme-platform/pages/voting-web.md`
 * for the full migration record and this agent's final report for the Phase 2/2.5 audit behind
 * the one structural change made this pass (winner banner promoted out of the scrolling list, see
 * below).
 *
 * STRUCTURAL CHANGE (Phase 2.5, not a copy/color variant): the retired version passed the period
 * tabs + winner banner + "Top Contenders" label as the `FlatList`'s `ListHeaderComponent`, which
 * means all of it scrolled away with the standings list on anything past a handful of rows —
 * forcing a scroll back to the top to re-check the winner or switch periods, and making the
 * "yesterday's winner" banner easy to misread as sitting inside today's live ranking simply
 * because they shared one scrolling region. That block now lives in a persistent (non-scrolling)
 * header region above the `FlatList`, exactly like `WebVotingTopBar` already is — only the
 * standings rows themselves scroll. No new width/breakpoint logic or shared `DesktopShell` change
 * needed; this is a self-contained layout restructure.
 */
function VotingScreenContent() {
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const [activeTab, setActiveTab] = useState<CompetitionPeriodType>('day');
  const [selectedContent, setSelectedContent] = useState<StandingContent | null>(null);

  const standingsQuery = useCurrentStandings(activeTab);
  const winnerQuery = useWinner(activeTab, previousPeriodKey(activeTab), true);

  const activeTabMeta = TABS.find((tab) => tab.type === activeTab)!;
  const items = standingsQuery.data?.items ?? [];

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  // Surfaces `StandingsPageResponse.is_closed` — returned by the API today but never rendered by
  // the native screen. Real UX gap, carried forward from the retired system: with no snapshot
  // (standings are live-computed, per voting-system.md), a viewer has no way to tell "this
  // ranking can still change" from "this period is decided" apart from this field.
  //
  // "Live" is a solid `indigoSecondary` fill + `onAccent` text (verified 9.0:1 dark / 6.46:1
  // light — see WebVotingTabs for the same contrast reasoning). "Final" is a neutral outline pill
  // (border + `foreground` text), matching this system's own "solid fill = active/urgent, outline
  // = settled" convention rather than inventing a new one for this badge alone.
  const periodStatusBadge = standingsQuery.data ? (
    standingsQuery.data.is_closed ? (
      <View style={[styles.statusBadge, styles.statusBadgeOutline]}>
        <Text style={[type.label, { color: colors.foreground }]}>Final</Text>
      </View>
    ) : (
      <View style={[styles.statusBadge, { backgroundColor: colors.indigoSecondary }]}>
        <View style={[styles.statusDot, { backgroundColor: colors.onAccent }]} />
        <Text style={[type.label, { color: colors.onAccent }]}>Live</Text>
      </View>
    )
  ) : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebVotingTopBar title="Competitions" />

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
            <Text style={[type.label, { color: colors.foregroundMuted }]}>Top Contenders</Text>
            {periodStatusBadge}
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => (item.content.kind === 'meme' ? item.content.meme.id : item.content.container.id)}
          renderItem={({ item }) => <WebStandingRow entry={item} onPress={setSelectedContent} />}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          ListEmptyComponent={
            standingsQuery.isLoading ? (
              <ActivityIndicator style={styles.emptyPad} color={colors.foregroundMuted} />
            ) : standingsQuery.isError ? (
              <Text style={[type.body, styles.emptyPad, { color: colors.error }]}>{standingsQuery.error?.message}</Text>
            ) : (
              <Text style={[type.body, styles.emptyPad, { color: colors.foregroundMuted, textAlign: 'center' }]}>
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
    <VaporwaveThemeProvider>
      <VotingScreenContent />
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
      marginBottom: spacing.lg,
      marginHorizontal: spacing.lg,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    statusBadgeOutline: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    emptyPad: {
      marginTop: spacing.xxl,
      marginHorizontal: spacing.lg,
    },
  });
