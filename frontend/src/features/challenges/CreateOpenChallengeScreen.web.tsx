import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebDurationPresets } from '@/components/web/WebDurationPresets';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
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
 * untouched). Migrated off the retired independent Neubrutalism theme onto the project-standard
 * Vaporwave/Luminous glass system — see `design-system/meme-platform/pages/compete-web.md` for
 * the shared `WebDurationPresets` addition history (unchanged this pass, carried forward). */
function CreateOpenChallengeScreenContent() {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const createOpenChallenge = useCreateOpenChallengeMutation();

  const [title, setTitle] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [sideAName, setSideAName] = useState('Team A');
  const [sideBName, setSideBName] = useState('Team B');
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

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
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title="Start an Open Challenge" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[type.body, { color: colors.foregroundMuted, marginBottom: spacing.lg }]}>
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

          <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.xs }]}>Duration</Text>
          <WebDurationPresets minutesValue={durationMinutes} onSelect={(m) => setDurationMinutes(String(m))} />
          <WebCompeteTextField
            label="Custom duration (minutes)"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
          />
          <WebCompeteTextField label="Side A name" value={sideAName} onChangeText={setSideAName} />
          <WebCompeteTextField label="Side B name" value={sideBName} onChangeText={setSideBName} />

          {formError ? <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{formError}</Text> : null}
          {createOpenChallenge.isError ? (
            <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{createOpenChallenge.error?.message}</Text>
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
    <VaporwaveThemeProvider>
      <CreateOpenChallengeScreenContent />
    </VaporwaveThemeProvider>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flex: 1, paddingHorizontal: spacing.lg },
    scrollContent: { paddingTop: spacing.lg, paddingBottom: 48 },
    tagSpinner: { marginTop: -spacing.md, marginBottom: spacing.lg },
    submitWrap: { marginTop: spacing.sm },
  });
