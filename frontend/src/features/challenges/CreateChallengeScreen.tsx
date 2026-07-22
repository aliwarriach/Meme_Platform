import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SideMemberPicker } from '@/features/challenges/components/SideMemberPicker';
import { useMembers } from '@/services/useCommunities';
import { useCreateChallengeMutation } from '@/services/useChallenges';

interface CreateChallengeScreenProps {
  communityId: string;
}

// Setup is entirely creator-driven (owner assigns sides/members up front, no self-signup) —
// keeps this phase's scope to the confirmed design: a fixed 2-side intra-community shape.
const DEFAULT_DURATION_MINUTES = 30;

export default function CreateChallengeScreen({ communityId }: CreateChallengeScreenProps) {
  const router = useRouter();
  const membersQuery = useMembers(communityId);
  const createChallenge = useCreateChallengeMutation(communityId);

  const [title, setTitle] = useState('');
  const [sideAName, setSideAName] = useState('Team A');
  const [sideBName, setSideBName] = useState('Team B');
  const [sideAMembers, setSideAMembers] = useState<Set<string>>(new Set());
  const [sideBMembers, setSideBMembers] = useState<Set<string>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  const toggleSideA = (userId: string) => {
    setSideAMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    setSideBMembers((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const toggleSideB = (userId: string) => {
    setSideBMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    setSideAMembers((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleSubmit = () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError('Give the challenge a title');
      return;
    }
    if (sideAMembers.size === 0 || sideBMembers.size === 0) {
      setFormError('Both sides need at least one member');
      return;
    }
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFormError('Duration must be a positive number of minutes');
      return;
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);

    createChallenge.mutate(
      {
        title: title.trim(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        sides: [
          { name: sideAName.trim() || 'Team A', member_ids: Array.from(sideAMembers) },
          { name: sideBName.trim() || 'Team B', member_ids: Array.from(sideBMembers) },
        ],
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
            New Challenge
          </Text>
        </View>

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Title
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Meme War"
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

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Side A name
        </Text>
        <TextInput
          value={sideAName}
          onChangeText={setSideAName}
          accessibilityLabel="Side A name"
          className="mb-2 min-h-[44px] rounded-xl border border-neutral-300 px-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
        />

        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Side B name
        </Text>
        <TextInput
          value={sideBName}
          onChangeText={setSideBName}
          accessibilityLabel="Side B name"
          className="mb-4 min-h-[44px] rounded-xl border border-neutral-300 px-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
        />

        {membersQuery.isLoading ? (
          <ActivityIndicator className="my-4" />
        ) : membersQuery.isError ? (
          <Text className="text-sm text-red-500">{membersQuery.error?.message}</Text>
        ) : (
          <>
            <SideMemberPicker
              members={membersQuery.data ?? []}
              sideName={sideAName}
              selectedUserIds={sideAMembers}
              disabledUserIds={sideBMembers}
              onToggle={toggleSideA}
            />
            <SideMemberPicker
              members={membersQuery.data ?? []}
              sideName={sideBName}
              selectedUserIds={sideBMembers}
              disabledUserIds={sideAMembers}
              onToggle={toggleSideB}
            />
          </>
        )}

        {formError ? <Text className="mb-2 text-sm text-red-500">{formError}</Text> : null}
        {createChallenge.isError ? (
          <Text className="mb-2 text-sm text-red-500">{createChallenge.error?.message}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start challenge"
          onPress={handleSubmit}
          disabled={createChallenge.isPending}
          className="mb-8 items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50">
          <Text className="font-bold text-white">
            {createChallenge.isPending ? 'Starting…' : 'Start challenge'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
