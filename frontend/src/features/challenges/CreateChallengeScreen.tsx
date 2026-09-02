import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import { KeyboardAwareForm } from '@/components/KeyboardAvoidingScreen';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
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
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="New Challenge" showBack />
      <KeyboardAwareForm className="flex-1 px-6 pt-4">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Meme War" />
        <TextField
          label="Duration (minutes)"
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
        />
        <TextField label="Side A name" value={sideAName} onChangeText={setSideAName} />
        <TextField label="Side B name" value={sideBName} onChangeText={setSideBName} />

        {membersQuery.isLoading ? (
          <ActivityIndicator className="my-4" color={c.inkMuted} />
        ) : membersQuery.isError ? (
          <Text className="font-body text-sm text-error">{membersQuery.error?.message}</Text>
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

        {formError ? <Text className="mb-2 font-body text-sm text-error">{formError}</Text> : null}
        {createChallenge.isError ? (
          <Text className="mb-2 font-body text-sm text-error">{createChallenge.error?.message}</Text>
        ) : null}

        <View className="mb-8">
          <PillButton
            label={createChallenge.isPending ? 'Starting…' : 'Launch Challenge'}
            onPress={handleSubmit}
            loading={createChallenge.isPending}
          />
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}
