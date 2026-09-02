import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import { KeyboardAwareForm } from '@/components/KeyboardAvoidingScreen';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useHashtagSearch } from '@/services/useHashtags';
import { useCreateOpenChallengeMutation } from '@/services/useChallenges';

const DEFAULT_DURATION_MINUTES = 60 * 24;

// Mirrors the backend's `normalize_hashtag` closely enough for a live UX hint — the
// server is the real authority, this only decides whether to show the "already taken"
// warning before the user submits.
function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export default function CreateOpenChallengeScreen() {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const createOpenChallenge = useCreateOpenChallengeMutation();

  const [title, setTitle] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [sideAName, setSideAName] = useState('Team A');
  const [sideBName, setSideBName] = useState('Team B');
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  const normalizedTag = useMemo(() => normalize(hashtag), [hashtag]);
  const tagSearchQuery = useHashtagSearch(normalizedTag);
  const conflictingTag = (tagSearchQuery.data ?? []).find(
    (suggestion) => suggestion.slug === normalizedTag && suggestion.challenge_id
  );

  const handleSubmit = () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError('Give the challenge a title');
      return;
    }
    if (!normalizedTag) {
      setFormError('Give the challenge an entry hashtag');
      return;
    }
    if (conflictingTag) {
      setFormError(`#${normalizedTag} is already reserved by "${conflictingTag.challenge_title}"`);
      return;
    }
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFormError('Duration must be a positive number of minutes');
      return;
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);

    createOpenChallenge.mutate(
      {
        title: title.trim(),
        hashtag: normalizedTag,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        sides: [{ name: sideAName.trim() || 'Team A' }, { name: sideBName.trim() || 'Team B' }],
      },
      {
        onSuccess: (challenge) =>
          router.replace({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } }),
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Start an Open Challenge" showBack />
      <KeyboardAwareForm className="flex-1 px-6 pt-4">
        <Text className="mb-4 font-body text-sm text-ink-muted">
          Anyone can join — no community required. Entry is by posting with your reserved tag.
        </Text>

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Dogs vs Cats" />
        <TextField
          label="Entry hashtag"
          value={hashtag}
          onChangeText={setHashtag}
          placeholder="dogsvscats"
        />
        {normalizedTag ? (
          <View className="-mt-3 mb-4">
            {tagSearchQuery.isLoading ? (
              <ActivityIndicator size="small" color={c.inkMuted} />
            ) : conflictingTag ? (
              <Text className="font-body text-xs text-error">
                #{normalizedTag} is already taken by &quot;{conflictingTag.challenge_title}&quot;
              </Text>
            ) : (
              <Text className="font-body text-xs text-ink-muted">
                Entries post with #{normalizedTag}
              </Text>
            )}
          </View>
        ) : null}

        <TextField
          label="Duration (minutes)"
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
        />
        <TextField label="Side A name" value={sideAName} onChangeText={setSideAName} />
        <TextField label="Side B name" value={sideBName} onChangeText={setSideBName} />

        {formError ? <Text className="mb-2 font-body text-sm text-error">{formError}</Text> : null}
        {createOpenChallenge.isError ? (
          <Text className="mb-2 font-body text-sm text-error">{createOpenChallenge.error?.message}</Text>
        ) : null}

        <View className="mb-8">
          <PillButton
            label={createOpenChallenge.isPending ? 'Starting…' : 'Start Challenge'}
            onPress={handleSubmit}
            loading={createOpenChallenge.isPending}
          />
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}
