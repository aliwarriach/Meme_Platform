import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebChallengeSideCard } from '@/components/web/WebChallengeSideCard';
import { WebChallengeStatusBadge } from '@/components/web/WebChallengeStatusBadge';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebCountdownTimer } from '@/components/web/WebCountdownTimer';
import { WebResultBanner } from '@/components/web/WebResultBanner';
import { WebSubmissionThumb } from '@/components/web/WebSubmissionThumb';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import {
  useAcceptDuelMutation,
  useChallengeFlat,
  useChallengeResultsFlat,
  useDeclineDuelMutation,
  useJoinOpenChallengeMutation,
} from '@/services/useChallenges';
import type { RootState } from '@/store/store';

interface DuelDetailScreenProps {
  challengeId: string;
}

/**
 * Web-only sibling of `features/challenges/DuelDetailScreen.tsx` (native-resolved, untouched) —
 * community-less challenge detail for duels and `open` challenges, reached via the flat
 * `/challenges/[challengeId]` route. Migrated off the retired independent Neubrutalism theme onto
 * the project-standard Vaporwave/Luminous glass system — see
 * `design-system/meme-platform/pages/compete-web.md`. Same business logic/data as native (local
 * join-state tracking for `open` challenges, since `member_ids` is always `[]` for that shape —
 * see the detailed rationale in the native component and `.claude/memory/challenges.md`), only
 * chrome changed.
 */
function DuelDetailScreenContent({ challengeId }: DuelDetailScreenProps) {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [locallyJoinedSideId, setLocallyJoinedSideId] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const challengeQuery = useChallengeFlat(challengeId);
  const challenge = challengeQuery.data;

  const isPendingProposal = challenge?.status === 'setup';
  const isEvaluated = challenge?.status === 'evaluated';
  const resultsQuery = useChallengeResultsFlat(challengeId, isEvaluated);

  const acceptDuel = useAcceptDuelMutation();
  const declineDuel = useDeclineDuelMutation();
  const joinChallenge = useJoinOpenChallengeMutation();

  if (challengeQuery.isLoading || !challenge) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.centerSafe}>
          {challengeQuery.isError ? (
            <Text style={[type.body, styles.centerPad, { color: colors.error }]}>{challengeQuery.error?.message}</Text>
          ) : (
            <ActivityIndicator color={colors.foregroundMuted} />
          )}
        </SafeAreaView>
      </View>
    );
  }

  const isOpenChallenge = challenge.challenge_type === 'open';
  const isInvitee = challenge.invitee_id === currentUser?.id;
  const mySideId =
    challenge.sides.find((side) => side.member_ids.includes(currentUser?.id ?? ''))?.id ??
    locallyJoinedSideId ??
    undefined;
  const winningSide = challenge.sides.find((side) => side.id === challenge.winning_side_id);
  const submissions = resultsQuery.data?.submissions ?? [];

  const onJoinSide = (sideId: string) => {
    setJoinNotice(null);
    joinChallenge.mutate(
      { challengeId, sideId },
      {
        onSuccess: () => setLocallyJoinedSideId(sideId),
        onError: () => setJoinNotice("You've already picked a side in this challenge."),
      }
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title={challenge.title} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.statusCluster, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
            <WebChallengeStatusBadge status={challenge.status} />
            {challenge.status === 'active' ? (
              <WebCountdownTimer endTime={challenge.end_time} style={[type.meta, { color: colors.foregroundMuted }]} />
            ) : isEvaluated ? (
              <Text style={[type.meta, { color: colors.foregroundMuted }]}>
                Ended {new Date(challenge.end_time).toLocaleString()}
              </Text>
            ) : null}
          </View>

          {isEvaluated ? <WebResultBanner winnerName={winningSide?.name ?? null} /> : null}

          <View style={styles.sidesRow}>
            <WebChallengeSideCard
              side={challenge.sides[0]}
              isViewerSide={challenge.sides[0]?.id === mySideId}
              isWinner={challenge.sides[0]?.id === challenge.winning_side_id}
              showMemberCount={!isOpenChallenge}
              showParticipantCount={isOpenChallenge}
              onJoin={
                isOpenChallenge && challenge.status === 'active' && !mySideId
                  ? () => onJoinSide(challenge.sides[0].id)
                  : undefined
              }
              joinLoading={joinChallenge.isPending && joinChallenge.variables?.sideId === challenge.sides[0]?.id}
            />
            <Text style={[type.h2, styles.vsText, { color: colors.foregroundMuted }]}>VS</Text>
            <WebChallengeSideCard
              side={challenge.sides[1]}
              isViewerSide={challenge.sides[1]?.id === mySideId}
              isWinner={challenge.sides[1]?.id === challenge.winning_side_id}
              showMemberCount={!isOpenChallenge}
              showParticipantCount={isOpenChallenge}
              onJoin={
                isOpenChallenge && challenge.status === 'active' && !mySideId
                  ? () => onJoinSide(challenge.sides[1].id)
                  : undefined
              }
              joinLoading={joinChallenge.isPending && joinChallenge.variables?.sideId === challenge.sides[1]?.id}
            />
          </View>
          {joinNotice ? (
            <Text style={[type.body, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>{joinNotice}</Text>
          ) : null}

          {isPendingProposal && isInvitee ? (
            <View style={styles.actionsRow}>
              <WebCompeteButton
                label={acceptDuel.isPending ? 'Accepting…' : 'Accept'}
                onPress={() => acceptDuel.mutate(challengeId)}
                loading={acceptDuel.isPending}
                disabled={declineDuel.isPending}
              />
              <WebCompeteButton
                label={declineDuel.isPending ? 'Declining…' : 'Decline'}
                variant="outline"
                onPress={() => declineDuel.mutate(challengeId)}
                loading={declineDuel.isPending}
                disabled={acceptDuel.isPending}
              />
            </View>
          ) : null}
          {acceptDuel.isError || declineDuel.isError ? (
            <Text style={[type.body, { color: colors.error, marginTop: spacing.sm }]}>
              {acceptDuel.error?.message ?? declineDuel.error?.message}
            </Text>
          ) : null}
          {isPendingProposal && !isInvitee ? (
            <Text style={[type.body, { color: colors.foregroundMuted, marginTop: spacing.sm }]}>
              Waiting for {challenge.invitee?.username ?? 'your opponent'} to respond.
            </Text>
          ) : null}

          {challenge.status === 'active' && mySideId ? (
            <View style={styles.section}>
              <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>
                Competing for {challenge.sides.find((s) => s.id === mySideId)?.name}
              </Text>
              <WebCompeteButton
                label="Create a meme for this challenge"
                onPress={() => router.push({ pathname: '/new-post', params: { challengeId } })}
                fullWidth
              />
            </View>
          ) : null}

          {isEvaluated ? (
            <View style={styles.section}>
              <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>Submissions</Text>
              {resultsQuery.isLoading ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={colors.foregroundMuted} />
              ) : resultsQuery.isError ? (
                <Text style={[type.body, { color: colors.error }]}>{resultsQuery.error?.message}</Text>
              ) : submissions.length === 0 ? (
                <Text style={[type.body, { color: colors.foregroundMuted }]}>No submissions were made.</Text>
              ) : (
                <View style={styles.submissionsGrid}>
                  {submissions.map((submission) => (
                    <WebSubmissionThumb
                      key={submission.id}
                      imageUrl={submission.meme.image_url}
                      footerLabel={submission.submitter.username}
                      caption={challenge.sides.find((s) => s.id === submission.side_id)?.name}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function DuelDetailScreen(props: DuelDetailScreenProps) {
  return (
    <VaporwaveThemeProvider>
      <DuelDetailScreenContent {...props} />
    </VaporwaveThemeProvider>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    centerSafe: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerPad: { paddingHorizontal: spacing.lg, textAlign: 'center' },
    scroll: { flex: 1, paddingHorizontal: spacing.lg },
    scrollContent: { paddingTop: spacing.lg, paddingBottom: 48 },
    statusCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    sidesRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    vsText: {
      alignSelf: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    section: {
      marginTop: spacing.lg,
    },
    submissionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  });
