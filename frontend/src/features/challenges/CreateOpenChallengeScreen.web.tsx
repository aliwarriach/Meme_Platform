import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebDurationPresets } from '@/components/web/WebDurationPresets';
import { CompeteThemeProvider, useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_SPACING, COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';
import { useHashtagSearch } from '@/services/useHashtags';
import { useCreateOpenChallengeMutation } from '@/services/useChallenges';

const DEFAULT_DURATION_MINUTES = 60 * 24;

// Mirrors the backend's `normalize_hashtag` closely enough for a live UX hint — the server is
// the real authority, this only decides whether to show the "already taken" warning.
function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Web-only sibling of `features/challenges/CreateOpenChallengeScreen.tsx` (native-resolved,
 * untouched). See compete-web.md's "UX improvements" for the shared `WebDurationPresets`
 * addition (identical gap/fix across all three create/propose screens). */
function CreateOpenChallengeScreenContent() {
  const router = useRouter();
  const { colors } = useCompeteWebTheme();
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title="Start an Open Challenge" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[COMPETE_WEB_TYPE.body, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.lg }]}>
            Anyone can join — no community required. Entry is by posting with your reserved tag.
          </Text>

          <WebCompeteTextField label="Title" value={title} onChangeText={setTitle} placeholder="Dogs vs Cats" />
          <WebCompeteTextField
            label="Entry hashtag"
            value={hashtag}
            onChangeText={setHashtag}
            placeholder="dogsvscats"
            hint={
              !normalizedTag
                ? undefined
                : tagSearchQuery.isLoading
                  ? undefined
                  : conflictingTag
                    ? undefined
                    : `Entries post with #${normalizedTag}`
            }
            error={conflictingTag ? `#${normalizedTag} is already taken by "${conflictingTag.challenge_title}"` : undefined}
          />
          {normalizedTag && tagSearchQuery.isLoading ? (
            <ActivityIndicator size="small" color={colors.foregroundMuted} style={styles.tagSpinner} />
          ) : null}

          <Text style={[COMPETE_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.xs }]}>
            Duration
          </Text>
          <WebDurationPresets minutesValue={durationMinutes} onSelect={(m) => setDurationMinutes(String(m))} />
          <WebCompeteTextField
            label="Custom duration (minutes)"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
          />
          <WebCompeteTextField label="Side A name" value={sideAName} onChangeText={setSideAName} />
          <WebCompeteTextField label="Side B name" value={sideBName} onChangeText={setSideBName} />

          {formError ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.destructiveText, marginBottom: COMPETE_WEB_SPACING.sm }]}>
              {formError}
            </Text>
          ) : null}
          {createOpenChallenge.isError ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.destructiveText, marginBottom: COMPETE_WEB_SPACING.sm }]}>
              {createOpenChallenge.error?.message}
            </Text>
          ) : null}

          <View style={styles.submitWrap}>
            <WebCompeteButton
              label={createOpenChallenge.isPending ? 'Starting…' : 'Start Challenge'}
              onPress={handleSubmit}
              loading={createOpenChallenge.isPending}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function CreateOpenChallengeScreen() {
  return (
    <CompeteThemeProvider>
      <CreateOpenChallengeScreenContent />
    </CompeteThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1, paddingHorizontal: COMPETE_WEB_SPACING.lg },
  scrollContent: { paddingTop: COMPETE_WEB_SPACING.lg, paddingBottom: 48 },
  tagSpinner: { marginTop: -COMPETE_WEB_SPACING.md, marginBottom: COMPETE_WEB_SPACING.lg },
  submitWrap: { marginTop: COMPETE_WEB_SPACING.sm },
});
