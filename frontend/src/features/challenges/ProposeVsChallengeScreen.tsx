import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDiscoverCommunities } from '@/services/useCommunities';
import { useProposeVsChallengeMutation } from '@/services/useChallenges';

interface ProposeVsChallengeScreenProps {
  communityId: string;
}

const DEFAULT_DURATION_MINUTES = 30;

export default function ProposeVsChallengeScreen({ communityId }: ProposeVsChallengeScreenProps) {
  const router = useRouter();
  const discoverQuery = useDiscoverCommunities();
  const proposeChallenge = useProposeVsChallengeMutation(communityId);

  const [title, setTitle] = useState('');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  const opponents = (discoverQuery.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (community) => community.id !== communityId
  );

  const handleSubmit = () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError('Give the challenge a title');
      return;
    }
    if (!opponentId) {
      setFormError('Pick a community to challenge');
      return;
    }
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFormError('Duration must be a positive number of minutes');
      return;
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);

    proposeChallenge.mutate(
      {
        opponentCommunityId: opponentId,
        title: title.trim(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      },
      {
        onSuccess: (challenge) =>
          router.replace({
            pathname: '/communities/[id]/challenges/[challengeId]',
            params: { id: communityId, challengeId: challenge.id },
          }),
      }
    );
  };

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
          <Text className="ml-2 text-xl font-extrabold text-neutral-900 dark:text-white">
            Challenge a Community
          </Text>
        </View>

        <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          The other community&apos;s owner must accept before the challenge starts.
        </Text>

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Title
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Community Showdown"
          accessibilityLabel="Challenge title"
          className="mb-4 min-h-[44px] rounded-xl border border-neutral-300 px-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
        />

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Duration (minutes)
        </Text>
        <TextInput
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
          accessibilityLabel="Challenge duration in minutes"
          className="mb-4 min-h-[44px] rounded-xl border border-neutral-300 px-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
        />

        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Opponent community
        </Text>
        {discoverQuery.isLoading ? (
          <ActivityIndicator className="my-4" />
        ) : discoverQuery.isError ? (
          <Text className="text-sm text-red-500">{discoverQuery.error?.message}</Text>
        ) : opponents.length === 0 ? (
          <Text className="mb-4 text-sm text-neutral-400">No other communities to challenge yet</Text>
        ) : (
          <View className="mb-4">
            {opponents.map((community) => {
              const selected = community.id === opponentId;
              return (
                <Pressable
                  key={community.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Challenge ${community.name}`}
                  onPress={() => setOpponentId(community.id)}
                  className={`mb-2 min-h-[44px] flex-row items-center rounded-xl border px-3 ${
                    selected
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}>
                  <Text className={selected ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                    {community.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {formError ? <Text className="mb-2 text-sm text-red-500">{formError}</Text> : null}
        {proposeChallenge.isError ? (
          <Text className="mb-2 text-sm text-red-500">{proposeChallenge.error?.message}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send challenge proposal"
          onPress={handleSubmit}
          disabled={proposeChallenge.isPending}
          className="mb-8 items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50">
          <Text className="font-bold text-white">
            {proposeChallenge.isPending ? 'Sending…' : 'Send challenge'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
