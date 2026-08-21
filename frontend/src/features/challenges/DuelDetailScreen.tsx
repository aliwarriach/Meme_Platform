import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useColorScheme } from 'nativewind';

import PillButton from '@/components/PillButton';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { CountdownTimer } from '@/features/challenges/components/CountdownTimer';
import {
  useAcceptDuelMutation,
  useChallengeFlat,
  useChallengeResultsFlat,
  useDeclineDuelMutation,
  useJoinOpenChallengeMutation,
} from '@/services/useChallenges';
import type { RootState } from '@/store/store';

interface FlatChallengeDetailScreenProps {
  challengeId: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-tertiary',
  evaluated: 'bg-primary-container',
  setup: 'bg-surface-high',
};

/**
 * Community-less challenge detail — duels and `open` challenges, both reached via the
 * flat `/challenges/[challengeId]` route. Deliberately separate from `ChallengeDetailScreen`:
 * that screen's hooks (`useChallenge(communityId, ...)` etc.) all require a `communityId`,
 * which neither shape has — this mirrors its visual structure/business logic against the
 * flat hooks instead of threading an optional communityId through the community-scoped flow.
 *
 * `open` challenges have an unbounded roster — `ChallengeSideOut.member_ids` is always `[]`
 * for them (see hashtags.md/challenges.md), so there's no server signal for "which side is
 * the viewer already on." Join state is tracked locally after a successful join instead —
 * honest for this session, resets on remount, and a re-join attempt is treated as
 * informational (not an error) rather than guessing which side the 400 refers to.
 */
export default function DuelDetailScreen({ challengeId }: FlatChallengeDetailScreenProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [locallyJoinedSideId, setLocallyJoinedSideId] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

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
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        {challengeQuery.isError ? (
          <Text className="px-6 text-center font-body text-sm text-error">
            {challengeQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator color={c.inkMuted} />
        )}
      </SafeAreaView>
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={challenge.title} showBack />
      <ScrollView className="flex-1 px-6 pt-4">
        <View className="mb-4 flex-row items-center gap-2">
          <View className={`rounded-full px-3 py-1 ${STATUS_STYLES[challenge.status]}`}>
            <Text className="font-label text-xs uppercase text-white">
              {isPendingProposal ? 'Awaiting response' : challenge.status}
            </Text>
          </View>
          {challenge.status === 'active' ? (
            <CountdownTimer endTime={challenge.end_time} className="font-body text-xs text-ink-muted" />
          ) : isEvaluated ? (
            <Text className="font-body text-xs text-ink-muted">
              Ended {new Date(challenge.end_time).toLocaleString()}
            </Text>
          ) : null}
        </View>

        {isEvaluated ? (
          <View className="mb-6 rounded-card bg-primary/15 p-4">
            <Text className="text-center font-heading text-lg text-primary-dim">
              {winningSide ? `🏆 ${winningSide.name} wins!` : 'Tie — no winner'}
            </Text>
          </View>
        ) : null}

        {challenge.sides.map((side, index) => (
          <View key={side.id}>
            {index === 1 ? (
              <Text className="my-1 text-center font-heading text-sm text-ink-muted">VS</Text>
            ) : null}
            <View
              className={`mb-1 rounded-card border p-3 ${
                side.id === challenge.winning_side_id
                  ? 'border-primary'
                  : 'border-outline-variant/30 bg-surface'
              }`}>
              <Text className="mb-1 font-title text-heading">
                {side.name} {side.id === mySideId ? '(you)' : ''}
              </Text>
              {typeof side.score === 'number' ? (
                <Text className="font-body text-xs text-ink-muted">Score: {side.score}</Text>
              ) : null}
              {isOpenChallenge ? (
                <Text className="font-body text-xs text-ink-muted">
                  {side.participant_count} joined
                </Text>
              ) : null}
              {isOpenChallenge && challenge.status === 'active' && !mySideId ? (
                <PillButton
                  label={joinChallenge.isPending ? 'Joining…' : `Join ${side.name}`}
                  variant="outline"
                  onPress={() => onJoinSide(side.id)}
                  loading={joinChallenge.isPending && joinChallenge.variables?.sideId === side.id}
                  className="mt-2"
                />
              ) : null}
            </View>
          </View>
        ))}
        {joinNotice ? <Text className="mb-2 font-body text-sm text-ink-muted">{joinNotice}</Text> : null}

        {isPendingProposal && isInvitee ? (
          <View className="mt-3 flex-row gap-3">
            <PillButton
              label={acceptDuel.isPending ? 'Accepting…' : 'Accept'}
              onPress={() => acceptDuel.mutate(challengeId)}
              loading={acceptDuel.isPending}
              disabled={declineDuel.isPending}
              className="flex-1"
            />
            <PillButton
              label={declineDuel.isPending ? 'Declining…' : 'Decline'}
              variant="outline"
              onPress={() => declineDuel.mutate(challengeId)}
              loading={declineDuel.isPending}
              disabled={acceptDuel.isPending}
              className="flex-1"
            />
          </View>
        ) : null}
        {acceptDuel.isError || declineDuel.isError ? (
          <Text className="mt-2 font-body text-sm text-error">
            {acceptDuel.error?.message ?? declineDuel.error?.message}
          </Text>
        ) : null}
        {isPendingProposal && !isInvitee ? (
          <Text className="mt-2 font-body text-sm text-ink-muted">
            Waiting for {challenge.invitee?.username ?? 'your opponent'} to respond.
          </Text>
        ) : null}

        {challenge.status === 'active' && mySideId ? (
          <View className="mt-4">
            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Competing for {challenge.sides.find((s) => s.id === mySideId)?.name}
            </Text>
            <PillButton
              label="Create a meme for this challenge"
              onPress={() => router.push({ pathname: '/new-post', params: { challengeId } })}
            />
          </View>
        ) : null}

        {isEvaluated ? (
          <View className="mt-2">
            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Submissions
            </Text>
            {resultsQuery.isLoading ? (
              <ActivityIndicator className="my-4" color={c.inkMuted} />
            ) : resultsQuery.isError ? (
              <Text className="font-body text-sm text-error">{resultsQuery.error?.message}</Text>
            ) : submissions.length === 0 ? (
              <Text className="font-body text-sm text-ink-muted">No submissions were made.</Text>
            ) : (
              submissions.map((submission) => (
                <View
                  key={submission.id}
                  className="mb-3 flex-row items-center border-b border-outline-variant/30 pb-3">
                  <Image
                    source={{ uri: submission.meme.image_url }}
                    style={{ width: 56, height: 56, borderRadius: 16 }}
                    contentFit="cover"
                  />
                  <View className="ml-3">
                    <Text className="font-title text-heading">{submission.submitter.username}</Text>
                    <Text className="font-body text-xs text-ink-muted">
                      {challenge.sides.find((s) => s.id === submission.side_id)?.name}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
