import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import { WebChallengeCard } from '@/components/web/WebChallengeCard';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebCompeteTabs } from '@/components/web/WebCompeteTabs';
import { CompeteThemeProvider, useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, injectCompeteWebFont, type WebPressableState } from '@/constants/webCompeteTheme';
import LeaderboardsPanel from '@/features/leaderboards/LeaderboardsPanel';
import { getFlag, setFlag } from '@/services/localFlags';
import type { ChallengeResponse } from '@/services/challenges';
import { useMyChallenges, useOpenChallenges } from '@/services/useChallenges';

type Segment = 'challenges' | 'leaderboards';

const EXPLAINER_FLAG = 'hasSeenCompeteExplainer';

// MASTER.md's own dark-only tokens (bg/surface/outline-variant/ink-muted/error/primary), fixed
// regardless of this page's own light/dark toggle — the native LeaderboardsPanel's rows assume
// MASTER's dark-only palette. Same accepted seam `community-web.md` documented for its own
// out-of-scope Leaderboard/Challenges tabs; see compete-web.md's "Known seams."
const MASTER_DARK_SURFACE = {
  bg: '#1e0f13',
  surface: '#2c1b1f',
  outlineVariant: '#5b3f46',
};

/** Community-scoped challenges route through their community; `open`/`duel` (no community)
 * route through the flat detail screen — same routing rule as native `CompeteScreen`. */
function goToChallenge(router: ReturnType<typeof useRouter>, challenge: ChallengeResponse) {
  if (challenge.community_id) {
    router.push({
      pathname: '/communities/[id]/challenges/[challengeId]',
      params: { id: challenge.community_id, challengeId: challenge.id },
    });
  } else {
    router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } });
  }
}

/**
 * Web-only sibling of `features/challenges/CompeteScreen.tsx` (native-resolved, untouched —
 * Expo Router prefers this file for every web bundle; `app/compete.tsx` needs zero changes).
 * RESKIN-mode pass, page-scoped to `design-system/meme-platform/pages/compete-web.md` — restyles
 * the existing Active/Open-to-join/Results + Challenges/Leaderboards structure rather than
 * rebuilding it.
 */
function CompeteScreenContent() {
  const router = useRouter();
  const { colors } = useCompeteWebTheme();
  const [segment, setSegment] = useState<Segment>('challenges');
  const [showExplainer, setShowExplainer] = useState(false);

  const myChallengesQuery = useMyChallenges();
  const openChallengesQuery = useOpenChallenges();

  useEffect(() => {
    injectCompeteWebFont();
    getFlag(EXPLAINER_FLAG).then((seen) => setShowExplainer(!seen));
  }, []);

  const dismissExplainer = () => {
    setShowExplainer(false);
    setFlag(EXPLAINER_FLAG, true);
  };

  const myChallenges = myChallengesQuery.data ?? [];
  const active = myChallenges.filter((c) => c.status === 'active' || c.status === 'setup');
  const results = myChallenges.filter((c) => c.status === 'evaluated');
  const myChallengeIds = new Set(myChallenges.map((c) => c.id));
  const openToJoin = (openChallengesQuery.data ?? []).filter((c) => !myChallengeIds.has(c.id));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar
          title="Compete"
          showBack={false}
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start an open challenge"
              onPress={() => router.push('/compete/open/new')}
              style={({ hovered, focused }: WebPressableState) => [
                styles.addButton,
                { backgroundColor: colors.primary, borderColor: colors.outline },
                hovered && { opacity: 0.9 },
                focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
              ]}>
              <MaterialIcons name="add" size={22} color={colors.onPrimary} />
            </Pressable>
          }
        />

        <View style={styles.tabsWrap}>
          <WebCompeteTabs
            options={[
              { key: 'challenges', label: 'Challenges' },
              { key: 'leaderboards', label: 'Leaderboards' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </View>

        {segment === 'leaderboards' ? (
          <View style={[styles.leaderboardWrap, { backgroundColor: MASTER_DARK_SURFACE.bg }]}>
            <LeaderboardsPanel />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {showExplainer ? (
              // Card + border, not `elevated` — `elevated` is reserved for cardForeground/icon-only
              // pairings (see compete-web.md's Accessibility audit); this banner needs its "Got it"
              // action in `primaryText`, which measures under AA against the `elevated` tint.
              <View style={[styles.explainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[COMPETE_WEB_TYPE.cardTitle, { color: colors.cardForeground, marginBottom: 4 }]}>
                  Compete in challenges
                </Text>
                <Text style={[COMPETE_WEB_TYPE.body, { color: colors.cardForeground }]}>
                  Join a challenge from your communities, an open challenge anyone can enter, or
                  challenge a friend to a duel — post a meme to compete, and watch the scoreboard
                  live.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  onPress={dismissExplainer}
                  style={styles.dismissButton}>
                  <Text style={[COMPETE_WEB_TYPE.label, { color: colors.primaryText }]}>Got it</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={[COMPETE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
              Active
            </Text>
            {myChallengesQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : myChallengesQuery.isError ? (
              <Text style={[COMPETE_WEB_TYPE.body, styles.errorText, { color: colors.destructiveText }]}>
                {myChallengesQuery.error.message}
              </Text>
            ) : active.length === 0 ? (
              <Text style={[COMPETE_WEB_TYPE.body, styles.emptyText, { color: colors.foregroundMuted }]}>
                Nothing active — join an open challenge below or challenge a friend from your
                friends list.
              </Text>
            ) : (
              active.map((challenge) => (
                <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
              ))
            )}

            <Text style={[COMPETE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
              Open to join
            </Text>
            {openChallengesQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : openChallengesQuery.isError ? (
              <Text style={[COMPETE_WEB_TYPE.body, styles.errorText, { color: colors.destructiveText }]}>
                {openChallengesQuery.error.message}
              </Text>
            ) : openToJoin.length === 0 ? (
              <Text style={[COMPETE_WEB_TYPE.body, styles.emptyText, { color: colors.foregroundMuted }]}>
                No open challenges right now.
              </Text>
            ) : (
              openToJoin.map((challenge) => (
                <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
              ))
            )}

            {results.length > 0 ? (
              <>
                <Text style={[COMPETE_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
                  Results
                </Text>
                {results.map((challenge) => (
                  <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
                ))}
              </>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>

      <FloatingBottomNav active="compete" />
    </View>
  );
}

export default function CompeteScreen() {
  return (
    <CompeteThemeProvider>
      <CompeteScreenContent />
    </CompeteThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  addButton: {
    height: 40,
    width: 40,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    marginHorizontal: COMPETE_WEB_SPACING.lg,
    marginTop: COMPETE_WEB_SPACING.sm,
    marginBottom: COMPETE_WEB_SPACING.sm,
  },
  leaderboardWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: COMPETE_WEB_SPACING.lg,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: COMPETE_WEB_SPACING.sm,
  },
  explainer: {
    marginBottom: COMPETE_WEB_SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    padding: COMPETE_WEB_SPACING.lg,
  },
  dismissButton: {
    marginTop: COMPETE_WEB_SPACING.sm,
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
  },
  sectionLabel: {
    marginBottom: COMPETE_WEB_SPACING.sm,
    marginTop: COMPETE_WEB_SPACING.md,
  },
  spinner: {
    marginVertical: COMPETE_WEB_SPACING.lg,
  },
  errorText: {
    marginBottom: COMPETE_WEB_SPACING.lg,
  },
  emptyText: {
    marginBottom: COMPETE_WEB_SPACING.lg,
  },
});
