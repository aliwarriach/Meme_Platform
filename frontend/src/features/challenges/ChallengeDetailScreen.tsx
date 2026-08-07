import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import PillButton from '@/components/PillButton';
import TopBar from '@/components/TopBar';
import { CountdownTimer } from '@/features/challenges/components/CountdownTimer';
import { SubmissionPicker } from '@/features/challenges/components/SubmissionPicker';
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

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-tertiary',
  evaluated: 'bg-primary',
  setup: 'bg-surface-high',
};

export default function ChallengeDetailScreen({
  communityId,
  challengeId,
}: ChallengeDetailScreenProps) {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);

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

  // For an intra_community challenge, a side's roster is its explicit member_ids. For a
  // community_vs_community challenge there's no per-user roster — a side "belongs" to
  // whichever community is the viewer's own, matched via ChallengeSideResponse.community_id.
  const myOwnedCommunityIds = new Set(
    (myCommunitiesQuery.data ?? [])
      .filter((c) => c.owner.id === currentUser?.id)
      .map((c) => c.id)
  );
  const isOpponentOwner =
    isPendingProposal &&
    challenge?.opponent_community_id !== null &&
    myOwnedCommunityIds.has(challenge?.opponent_community_id ?? '');

  const mySideId = isVsChallenge
    ? challenge?.sides.find((side) =>
        (myCommunitiesQuery.data ?? []).some((c) => c.id === side.community_id)
      )?.id
    : challenge?.sides.find((side) => side.member_ids.includes(currentUser?.id ?? ''))?.id;

  const submissions = resultsQuery.data?.submissions ?? [];
  const submittedMemeIds = new Set(submissions.map((s) => s.meme.id));

  if (challengeQuery.isLoading || !challenge) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        {challengeQuery.isError ? (
          <Text className="px-6 text-center font-body text-sm text-error">
            {challengeQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator color="#e3bdc5" />
        )}
      </SafeAreaView>
    );
  }

  const winningSide = challenge.sides.find((side) => side.id === challenge.winning_side_id);

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
          ) : challenge.status === 'evaluated' ? (
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
                side.id === challenge.winning_side_id ? 'border-primary' : 'border-outline-variant/30 bg-surface'
              }`}>
              <Text className="mb-1 font-title text-heading">
                {side.name} {side.id === mySideId ? '(you)' : ''}
              </Text>
              {!isVsChallenge ? (
                <Text className="font-body text-xs text-ink-muted">
                  {side.member_ids.length} member{side.member_ids.length === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
          </View>
        ))}

        {isPendingProposal && isOpponentOwner ? (
          <View className="mt-3 flex-row gap-3">
            <PillButton
              label={acceptChallenge.isPending ? 'Accepting…' : 'Accept'}
              onPress={() => acceptChallenge.mutate(challengeId)}
              loading={acceptChallenge.isPending}
              disabled={declineChallenge.isPending}
              className="flex-1"
            />
            <PillButton
              label={declineChallenge.isPending ? 'Declining…' : 'Decline'}
              variant="outline"
              onPress={() => declineChallenge.mutate(challengeId)}
              loading={declineChallenge.isPending}
              disabled={acceptChallenge.isPending}
              className="flex-1"
            />
          </View>
        ) : null}
        {acceptChallenge.isError || declineChallenge.isError ? (
          <Text className="mt-2 font-body text-sm text-error">
            {acceptChallenge.error?.message ?? declineChallenge.error?.message}
          </Text>
        ) : null}
        {isPendingProposal && !isOpponentOwner ? (
          <Text className="mt-2 font-body text-sm text-ink-muted">
            Waiting for the challenged community&apos;s owner to respond.
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
              className="mb-4"
            />

            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Or submit something you already posted
            </Text>
            <SubmissionPicker
              memes={ownMemes}
              isLoading={feedQuery.isLoading}
              isSubmitting={submitMeme.isPending}
              submittedMemeIds={submittedMemeIds}
              onSubmit={(memeId) => submitMeme.mutate(memeId)}
            />
            {submitMeme.isError ? (
              <Text className="mb-4 font-body text-sm text-error">{submitMeme.error?.message}</Text>
            ) : null}
          </View>
        ) : null}

        {challenge.status === 'active' && !mySideId ? (
          <Text className="mt-4 font-body text-sm text-ink-muted">
            You are not assigned to a side in this challenge.
          </Text>
        ) : null}

        {isEvaluated ? (
          <View className="mt-2">
            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Submissions
            </Text>
            {resultsQuery.isLoading ? (
              <ActivityIndicator className="my-4" color="#e3bdc5" />
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
