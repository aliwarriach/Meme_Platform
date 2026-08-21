import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useDiscoverCommunities } from '@/services/useCommunities';
import { useProposeVsChallengeMutation } from '@/services/useChallenges';

interface ProposeVsChallengeScreenProps {
  communityId: string;
}

const DEFAULT_DURATION_MINUTES = 30;

export default function ProposeVsChallengeScreen({ communityId }: ProposeVsChallengeScreenProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Challenge a Community" showBack />
      <ScrollView className="flex-1 px-6 pt-4">
        <Text className="mb-4 font-body text-sm text-ink-muted">
          The other community&apos;s owner must accept before the challenge starts.
        </Text>

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Community Showdown" />
        <TextField
          label="Duration (minutes)"
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
        />

        <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
          Select Opponent
        </Text>
        {discoverQuery.isLoading ? (
          <ActivityIndicator className="my-4" color={c.inkMuted} />
        ) : discoverQuery.isError ? (
          <Text className="font-body text-sm text-error">{discoverQuery.error?.message}</Text>
        ) : opponents.length === 0 ? (
          <Text className="mb-4 font-body text-sm text-ink-muted">
            No other communities to challenge yet
          </Text>
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
                  className={`mb-2 min-h-[44px] flex-row items-center justify-between rounded-card border px-4 py-2 ${
                    selected ? 'border-primary bg-primary/15' : 'border-outline-variant bg-surface-high/40'
                  }`}>
                  <View>
                    <Text className={`font-title ${selected ? 'text-primary-dim' : 'text-heading'}`}>
                      {community.name}
                    </Text>
                    <Text className="font-body text-xs text-ink-muted">
                      {community.member_count} member{community.member_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {formError ? <Text className="mb-2 font-body text-sm text-error">{formError}</Text> : null}
        {proposeChallenge.isError ? (
          <Text className="mb-2 font-body text-sm text-error">{proposeChallenge.error?.message}</Text>
        ) : null}

        <View className="mb-8">
          <PillButton
            label={proposeChallenge.isPending ? 'Sending…' : 'Send Challenge'}
            onPress={handleSubmit}
            loading={proposeChallenge.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
