import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebDurationPresets } from '@/components/web/WebDurationPresets';
import { WebSideMemberPicker } from '@/components/web/WebSideMemberPicker';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useMembers } from '@/services/useCommunities';
import { useCreateChallengeMutation } from '@/services/useChallenges';

interface CreateChallengeScreenProps {
  communityId: string;
}

// Setup is entirely creator-driven (owner assigns sides/members up front, no self-signup) —
// same confirmed design as native.
const DEFAULT_DURATION_MINUTES = 30;

/** Web-only sibling of `features/challenges/CreateChallengeScreen.tsx` (native-resolved,
 * untouched). Migrated off the retired independent Neubrutalism theme onto the project-standard
 * Vaporwave/Luminous glass system — see `design-system/meme-platform/pages/compete-web.md` for
 * the shared `WebDurationPresets` addition history (unchanged this pass, carried forward). */
function CreateChallengeScreenContent({ communityId }: CreateChallengeScreenProps) {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const membersQuery = useMembers(communityId);
  const createChallenge = useCreateChallengeMutation(communityId);

  const [title, setTitle] = useState('');
  const [sideAName, setSideAName] = useState('Team A');
  const [sideBName, setSideBName] = useState('Team B');
  const [sideAMembers, setSideAMembers] = useState<Set<string>>(new Set());
  const [sideBMembers, setSideBMembers] = useState<Set<string>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const toggleSideA = (userId: string) => {
    setSideAMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
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
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
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
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title="New Challenge" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <WebCompeteTextField label="Title" value={title} onChangeText={setTitle} placeholder="Meme War" />

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

          {membersQuery.isLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
          ) : membersQuery.isError ? (
            <Text style={[type.body, { color: colors.error }]}>{membersQuery.error?.message}</Text>
          ) : (
            <View style={styles.sidePickersRow}>
              <WebSideMemberPicker
                members={membersQuery.data ?? []}
                sideName={sideAName}
                selectedUserIds={sideAMembers}
                disabledUserIds={sideBMembers}
                onToggle={toggleSideA}
              />
              <WebSideMemberPicker
                members={membersQuery.data ?? []}
                sideName={sideBName}
                selectedUserIds={sideBMembers}
                disabledUserIds={sideAMembers}
                onToggle={toggleSideB}
              />
            </View>
          )}

          {formError ? <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{formError}</Text> : null}
          {createChallenge.isError ? (
            <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{createChallenge.error?.message}</Text>
          ) : null}

          <View style={styles.submitWrap}>
            <WebCompeteButton
              label={createChallenge.isPending ? 'Starting…' : 'Launch Challenge'}
              onPress={handleSubmit}
              loading={createChallenge.isPending}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function CreateChallengeScreen(props: CreateChallengeScreenProps) {
  return (
      <CreateChallengeScreenContent {...props} />
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flex: 1, paddingHorizontal: spacing.lg },
    scrollContent: { paddingTop: spacing.lg, paddingBottom: 48 },
    spinner: { marginVertical: spacing.lg },
    sidePickersRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    submitWrap: { marginTop: spacing.sm },
  });
