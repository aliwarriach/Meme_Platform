import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

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
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        {challengeQuery.isError ? (
          <Text className="px-6 text-center text-sm text-red-500">
            {challengeQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  const winningSide = challenge.sides.find((side) => side.id === challenge.winning_side_id);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView className="flex-1 px-6 pt-4">
        <View className="mb-4 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
          </Pressable>
          <Text className="ml-2 flex-1 text-xl font-extrabold text-neutral-900 dark:text-white">
            {challenge.title}
          </Text>
        </View>

        <View className="mb-4 flex-row items-center">
          <View
            className={`mr-2 rounded-full px-3 py-1 ${
              challenge.status === 'active'
                ? 'bg-green-500'
                : challenge.status === 'evaluated'
                  ? 'bg-orange-500'
                  : 'bg-neutral-300 dark:bg-neutral-700'
            }`}>
            <Text className="text-xs font-bold uppercase text-white">
              {isPendingProposal ? 'Awaiting response' : challenge.status}
            </Text>
          </View>
          {!isPendingProposal ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {challenge.status === 'active'
                ? `Ends ${new Date(challenge.end_time).toLocaleString()}`
                : `Ended ${new Date(challenge.end_time).toLocaleString()}`}
            </Text>
          ) : null}
        </View>

        {isEvaluated ? (
          <View className="mb-6 rounded-xl bg-orange-50 p-4 dark:bg-orange-950">
            <Text className="text-center text-lg font-extrabold text-orange-600 dark:text-orange-300">
              {winningSide ? `🏆 ${winningSide.name} wins!` : 'Tie — no winner'}
            </Text>
          </View>
        ) : null}

        {challenge.sides.map((side) => (
          <View
            key={side.id}
            className={`mb-3 rounded-xl border p-3 ${
              side.id === challenge.winning_side_id
                ? 'border-orange-500'
                : 'border-neutral-200 dark:border-neutral-800'
            }`}>
            <Text className="mb-1 font-bold text-neutral-900 dark:text-white">
              {side.name} {side.id === mySideId ? '(you)' : ''}
            </Text>
            {!isVsChallenge ? (
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {side.member_ids.length} member{side.member_ids.length === 1 ? '' : 's'}
              </Text>
            ) : null}
          </View>
        ))}

        {isPendingProposal && isOpponentOwner ? (
          <View className="mt-2 flex-row">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept challenge"
              onPress={() => acceptChallenge.mutate(challengeId)}
              disabled={acceptChallenge.isPending || declineChallenge.isPending}
              className="mr-2 flex-1 items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50">
              <Text className="font-bold text-white">
                {acceptChallenge.isPending ? 'Accepting…' : 'Accept'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline challenge"
              onPress={() => declineChallenge.mutate(challengeId, { onSuccess: () => router.back() })}
              disabled={acceptChallenge.isPending || declineChallenge.isPending}
              className="flex-1 items-center rounded-xl border border-red-500 py-3 disabled:opacity-50">
              <Text className="font-bold text-red-500">
                {declineChallenge.isPending ? 'Declining…' : 'Decline'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {(acceptChallenge.isError || declineChallenge.isError) ? (
          <Text className="mt-2 text-sm text-red-500">
            {acceptChallenge.error?.message ?? declineChallenge.error?.message}
          </Text>
        ) : null}
        {isPendingProposal && !isOpponentOwner ? (
          <Text className="mt-2 text-sm text-neutral-400">
            Waiting for the challenged community&apos;s owner to respond.
          </Text>
        ) : null}

        {challenge.status === 'active' && mySideId ? (
          <View className="mt-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Submit a meme for {challenge.sides.find((s) => s.id === mySideId)?.name}
            </Text>
            <SubmissionPicker
              memes={ownMemes}
              isLoading={feedQuery.isLoading}
              isSubmitting={submitMeme.isPending}
              submittedMemeIds={submittedMemeIds}
              onSubmit={(memeId) => submitMeme.mutate(memeId)}
            />
            {submitMeme.isError ? (
              <Text className="mb-4 text-sm text-red-500">{submitMeme.error?.message}</Text>
            ) : null}
          </View>
        ) : null}

        {challenge.status === 'active' && !mySideId ? (
          <Text className="mt-4 text-sm text-neutral-400">
            You are not assigned to a side in this challenge.
          </Text>
        ) : null}

        {isEvaluated ? (
          <View className="mt-2">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Submissions
            </Text>
            {resultsQuery.isLoading ? (
              <ActivityIndicator className="my-4" />
            ) : resultsQuery.isError ? (
              <Text className="text-sm text-red-500">{resultsQuery.error?.message}</Text>
            ) : submissions.length === 0 ? (
              <Text className="text-sm text-neutral-400">No submissions were made.</Text>
            ) : (
              submissions.map((submission) => (
                <View
                  key={submission.id}
                  className="mb-3 flex-row items-center border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <Image
                    source={{ uri: submission.meme.image_url }}
                    style={{ width: 56, height: 56, borderRadius: 10 }}
                    contentFit="cover"
                  />
                  <View className="ml-3">
                    <Text className="font-semibold text-neutral-900 dark:text-white">
                      {submission.submitter.username}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
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
