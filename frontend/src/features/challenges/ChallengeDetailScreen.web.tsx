import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebChallengeSideCard } from '@/components/web/WebChallengeSideCard';
import { WebChallengeStatusBadge } from '@/components/web/WebChallengeStatusBadge';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebCountdownTimer } from '@/components/web/WebCountdownTimer';
import { WebResultBanner } from '@/components/web/WebResultBanner';
import { WebSubmissionPicker } from '@/components/web/WebSubmissionPicker';
import { WebSubmissionThumb } from '@/components/web/WebSubmissionThumb';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { MemeResponse } from '@/services/memes';
import { useCommunityFeed } from '@/services/useMemes';
import { useMyCommunities } from '@/services/useCommunities';
import {
  useAcceptChallengeMutation,
  useChallenge,
  useChallengeResults,
  useDeclineChallengeMutation,
  useSubmitToChallengeMutation,
} from '@/services/useChallenges';
import type { RootState } from '@/store/store';

interface ChallengeDetailScreenProps {
  communityId: string;
  challengeId: string;
}

/**
 * Web-only sibling of `features/challenges/ChallengeDetailScreen.tsx` (native-resolved,
 * untouched) — community-scoped challenge detail, covering both `intra_community` and
 * `community_vs_community` shapes. Migrated off the retired independent Neubrutalism theme onto
 * the project-standard Vaporwave/Luminous glass system — see
 * `design-system/meme-platform/pages/compete-web.md`. Same business logic/data as native (side
 * resolution differs by shape, vs-proposal accept/decline gating, own-meme submission) — no
 * interaction-model change, only chrome.
 */
function ChallengeDetailScreenContent({ communityId, challengeId }: ChallengeDetailScreenProps) {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const challengeQuery = useChallenge(communityId, challengeId);
  const challenge = challengeQuery.data;

  const isVsChallenge = challenge?.challenge_type === 'community_vs_community';
  const isPendingProposal = challenge?.status === 'setup';
  const isEvaluated = challenge?.status === 'evaluated';
  const resultsQuery = useChallengeResults(communityId, challengeId, isEvaluated);

  const feedQuery = useCommunityFeed(communityId, !isEvaluated && !isPendingProposal);
  const ownMemes: MemeResponse[] =
    (feedQuery.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (meme) => meme.author.id === currentUser?.id
    ) ?? [];

  const submitMeme = useSubmitToChallengeMutation(communityId, challengeId);
  const acceptChallenge = useAcceptChallengeMutation(communityId);
  const declineChallenge = useDeclineChallengeMutation(communityId);
  const myCommunitiesQuery = useMyCommunities();

  const myOwnedCommunityIds = new Set(
    (myCommunitiesQuery.data ?? []).filter((c) => c.owner.id === currentUser?.id).map((c) => c.id)
  );
  const isOpponentOwner =
    isPendingProposal &&
    challenge?.opponent_community_id !== null &&
    myOwnedCommunityIds.has(challenge?.opponent_community_id ?? '');

  const mySideId = isVsChallenge
    ? challenge?.sides.find((side) => (myCommunitiesQuery.data ?? []).some((c) => c.id === side.community_id))?.id
    : challenge?.sides.find((side) => side.member_ids.includes(currentUser?.id ?? ''))?.id;

  const submissions = resultsQuery.data?.submissions ?? [];
  const submittedMemeIds = new Set(submissions.map((s) => s.meme.id));

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

  const winningSide = challenge.sides.find((side) => side.id === challenge.winning_side_id);

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
              showMemberCount={!isVsChallenge}
              showParticipantCount={false}
            />
            <Text style={[type.h2, styles.vsText, { color: colors.foregroundMuted }]}>VS</Text>
            <WebChallengeSideCard
              side={challenge.sides[1]}
              isViewerSide={challenge.sides[1]?.id === mySideId}
              isWinner={challenge.sides[1]?.id === challenge.winning_side_id}
              showMemberCount={!isVsChallenge}
              showParticipantCount={false}
            />
          </View>

          {isPendingProposal && isOpponentOwner ? (
            <View style={styles.actionsRow}>
              <WebCompeteButton
                label={acceptChallenge.isPending ? 'Accepting…' : 'Accept'}
                onPress={() => acceptChallenge.mutate(challengeId)}
                loading={acceptChallenge.isPending}
                disabled={declineChallenge.isPending}
              />
              <WebCompeteButton
                label={declineChallenge.isPending ? 'Declining…' : 'Decline'}
                variant="outline"
                onPress={() => declineChallenge.mutate(challengeId)}
                loading={declineChallenge.isPending}
                disabled={acceptChallenge.isPending}
              />
            </View>
          ) : null}
          {acceptChallenge.isError || declineChallenge.isError ? (
            <Text style={[type.body, { color: colors.error, marginTop: spacing.sm }]}>
              {acceptChallenge.error?.message ?? declineChallenge.error?.message}
            </Text>
          ) : null}
          {isPendingProposal && !isOpponentOwner ? (
            <Text style={[type.body, { color: colors.foregroundMuted, marginTop: spacing.sm }]}>
              Waiting for the challenged community&apos;s owner to respond.
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

              <Text style={[type.label, { color: colors.foregroundMuted, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                Or submit something you already posted
              </Text>
              <WebSubmissionPicker
                memes={ownMemes}
                isLoading={feedQuery.isLoading}
                isSubmitting={submitMeme.isPending}
                submittedMemeIds={submittedMemeIds}
                onSubmit={(memeId) => submitMeme.mutate(memeId)}
              />
              {submitMeme.isError ? (
                <Text style={[type.body, { color: colors.error, marginBottom: spacing.md }]}>{submitMeme.error?.message}</Text>
              ) : null}
            </View>
          ) : null}

          {challenge.status === 'active' && !mySideId ? (
            <Text style={[type.body, { color: colors.foregroundMuted, marginTop: spacing.lg }]}>
              You are not assigned to a side in this challenge.
            </Text>
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

export default function ChallengeDetailScreen(props: ChallengeDetailScreenProps) {
  return (
    <VaporwaveThemeProvider>
      <ChallengeDetailScreenContent {...props} />
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
