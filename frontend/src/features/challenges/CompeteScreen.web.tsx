import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import { WebChallengeCard } from '@/components/web/WebChallengeCard';
import { WebLeaderboardsPanel } from '@/components/web/WebLeaderboardsPanel';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebCompeteTabs } from '@/components/web/WebCompeteTabs';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { getFlag, setFlag } from '@/services/localFlags';
import type { ChallengeResponse } from '@/services/challenges';
import { useMyChallenges, useOpenChallenges } from '@/services/useChallenges';

type Segment = 'challenges' | 'leaderboards';

const EXPLAINER_FLAG = 'hasSeenCompeteExplainer';

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
 * Web-only sibling of `features/challenges/CompeteScreen.tsx` (native-resolved, untouched — Expo
 * Router prefers this file for every web bundle; `app/compete.tsx` needs zero changes). Migrated
 * off the retired independent Neubrutalism `webCompeteTheme.ts`/`CompeteWebTheme.tsx` system onto
 * the project-standard Vaporwave/Luminous glass system — see
 * `design-system/meme-platform/pages/compete-web.md` for the full migration record and this
 * agent's final report for the Phase 2/2.5 audit behind the one structural change made this pass.
 *
 * STRUCTURAL CHANGE (Phase 2.5, not a copy/color variant): the retired version bucketed
 * `useMyChallenges()`'s `setup`-status (pending, awaiting the viewer's/opponent's accept-decline)
 * and `active`-status (already running, action = submit a meme) challenges into a single "Active"
 * section, distinguished only by a small status badge. A first-time user scanning "what does this
 * screen need from me right now" had to read every card's badge to tell "you must respond to
 * this" apart from "this is just ongoing." Split into two sections in priority-of-attention order
 * — "Needs your response" (setup) above "Active" (in progress) — each rendering only when
 * non-empty, so a viewer with nothing pending sees no extra clutter. Real, content-grounded
 * change (uses `challenge.status`, already fetched — not a new field), not a visual variant.
 */
function CompeteScreenContent() {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const [segment, setSegment] = useState<Segment>('challenges');
  const [showExplainer, setShowExplainer] = useState(false);

  const myChallengesQuery = useMyChallenges();
  const openChallengesQuery = useOpenChallenges();

  useEffect(() => {
    injectFeedWebFont();
    getFlag(EXPLAINER_FLAG).then((seen) => setShowExplainer(!seen));
  }, []);

  const dismissExplainer = () => {
    setShowExplainer(false);
    setFlag(EXPLAINER_FLAG, true);
  };

  const myChallenges = myChallengesQuery.data ?? [];
  const needsResponse = myChallenges.filter((c) => c.status === 'setup');
  const active = myChallenges.filter((c) => c.status === 'active');
  const results = myChallenges.filter((c) => c.status === 'evaluated');
  const myChallengeIds = new Set(myChallenges.map((c) => c.id));
  const openToJoin = (openChallengesQuery.data ?? []).filter((c) => !myChallengeIds.has(c.id));

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar
          title="Compete"
          showBack={false}
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start an open challenge"
              onPress={() => router.push('/compete/open/new')}
              style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
                styles.addButton,
                { backgroundColor: colors.indigoSecondary },
                hovered && { opacity: 0.9 },
                focused && { outlineColor: colors.indigoPrimary, outlineWidth: 2, outlineOffset: 2 },
              ]}>
              <MaterialIcons name="add" size={22} color={colors.onAccent} />
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
          <View style={styles.leaderboardWrap}>
            <WebLeaderboardsPanel />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {showExplainer ? (
              <View style={[styles.explainer, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
                <Text style={[type.title, { color: colors.foreground, marginBottom: 4 }]}>Compete in challenges</Text>
                <Text style={[type.body, { color: colors.foregroundMuted }]}>
                  Join a challenge from your communities, an open challenge anyone can enter, or
                  challenge a friend to a duel — post a meme to compete, and watch the scoreboard
                  live.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  onPress={dismissExplainer}
                  style={styles.dismissButton}>
                  <Text style={[type.label, { color: colors.foreground }]}>Got it</Text>
                </Pressable>
              </View>
            ) : null}

            {myChallengesQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : myChallengesQuery.isError ? (
              <Text style={[type.body, styles.errorText, { color: colors.error }]}>{myChallengesQuery.error.message}</Text>
            ) : (
              <>
                {needsResponse.length > 0 ? (
                  <>
                    <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>
                      Needs your response
                    </Text>
                    {needsResponse.map((challenge) => (
                      <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
                    ))}
                  </>
                ) : null}

                <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Active</Text>
                {active.length === 0 ? (
                  <Text style={[type.body, styles.emptyText, { color: colors.foregroundMuted }]}>
                    Nothing active — join an open challenge below or challenge a friend from your
                    friends list.
                  </Text>
                ) : (
                  active.map((challenge) => (
                    <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
                  ))
                )}
              </>
            )}

            <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Open to join</Text>
            {openChallengesQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : openChallengesQuery.isError ? (
              <Text style={[type.body, styles.errorText, { color: colors.error }]}>{openChallengesQuery.error.message}</Text>
            ) : openToJoin.length === 0 ? (
              <Text style={[type.body, styles.emptyText, { color: colors.foregroundMuted }]}>No open challenges right now.</Text>
            ) : (
              openToJoin.map((challenge) => (
                <WebChallengeCard key={challenge.id} challenge={challenge} onPress={() => goToChallenge(router, challenge)} />
              ))
            )}

            {results.length > 0 ? (
              <>
                <Text style={[type.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Results</Text>
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
      <CompeteScreenContent />
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    addButton: {
      height: 40,
      width: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabsWrap: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    leaderboardWrap: {
      flex: 1,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    scrollContent: {
      paddingBottom: 100,
      paddingTop: spacing.sm,
    },
    explainer: {
      marginBottom: spacing.lg,
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing.lg,
    },
    dismissButton: {
      marginTop: spacing.sm,
      alignSelf: 'flex-end',
      minHeight: 32,
      justifyContent: 'center',
    },
    sectionLabel: {
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    spinner: {
      marginVertical: spacing.lg,
    },
    errorText: {
      marginBottom: spacing.lg,
    },
    emptyText: {
      marginBottom: spacing.lg,
    },
  });
