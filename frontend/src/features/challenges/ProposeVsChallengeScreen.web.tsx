import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebDurationPresets } from '@/components/web/WebDurationPresets';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useDiscoverCommunities } from '@/services/useCommunities';
import { useProposeVsChallengeMutation } from '@/services/useChallenges';

interface ProposeVsChallengeScreenProps {
  communityId: string;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

const DEFAULT_DURATION_MINUTES = 30;

/** Web-only sibling of `features/challenges/ProposeVsChallengeScreen.tsx` (native-resolved,
 * untouched). Migrated off the retired independent Neubrutalism theme onto the project-standard
 * Vaporwave/Luminous glass system — see `design-system/meme-platform/pages/compete-web.md` for
 * the shared `WebDurationPresets` addition history (unchanged this pass, carried forward). The
 * opponent-community picker is a small local row (single consumer, not extracted to
 * `components/web/` per this codebase's own "extract on 2nd occurrence" convention). */
function ProposeVsChallengeScreenContent({ communityId }: ProposeVsChallengeScreenProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  const discoverQuery = useDiscoverCommunities();
  const proposeChallenge = useProposeVsChallengeMutation(communityId);

  const [title, setTitle] = useState('');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

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
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title="Challenge a Community" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[type.body, { color: colors.foregroundMuted, marginBottom: spacing.lg }]}>
            The other community&apos;s owner must accept before the challenge starts.
          </Text>

          <WebCompeteTextField label="Title" value={title} onChangeText={setTitle} placeholder="Community Showdown" />

          <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.xs }]}>Duration</Text>
          <WebDurationPresets minutesValue={durationMinutes} onSelect={(m) => setDurationMinutes(String(m))} />
          <WebCompeteTextField
            label="Custom duration (minutes)"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
          />

          <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>Select Opponent</Text>
          {discoverQuery.isLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
          ) : discoverQuery.isError ? (
            <Text style={[type.body, { color: colors.error }]}>{discoverQuery.error?.message}</Text>
          ) : opponents.length === 0 ? (
            <Text style={[type.body, { color: colors.foregroundMuted, marginBottom: spacing.lg }]}>
              No other communities to challenge yet
            </Text>
          ) : (
            <View style={{ marginBottom: spacing.lg }}>
              {opponents.map((community) => {
                const selected = community.id === opponentId;
                return (
                  <Pressable
                    key={community.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`Challenge ${community.name}`}
                    onPress={() => setOpponentId(community.id)}
                    style={({ hovered, focused }: WebPressableState) => [
                      styles.opponentRow,
                      { backgroundColor: colors.surfaceGlass, borderColor: colors.border },
                      // Selection signal is a solid fill + onAccent, not a colored border/text —
                      // indigoSecondary measures too-close-in-luminance against a dark
                      // surface/border (~1.6-1.9:1, under 3:1) to be used as a border or text
                      // color directly on this row (see compete-web.md's Accessibility section).
                      selected && { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary },
                      hovered && !selected && { backgroundColor: colors.surfaceHover },
                      focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                    ]}>
                    <View>
                      <Text style={[type.title, { color: selected ? colors.onAccent : colors.foreground }]}>
                        {community.name}
                      </Text>
                      <Text style={[type.meta, { color: selected ? colors.onAccent : colors.foregroundMuted }]}>
                        {community.member_count} member{community.member_count === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {formError ? <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{formError}</Text> : null}
          {proposeChallenge.isError ? (
            <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>{proposeChallenge.error?.message}</Text>
          ) : null}

          <View style={styles.submitWrap}>
            <WebCompeteButton
              label={proposeChallenge.isPending ? 'Sending…' : 'Send Challenge'}
              onPress={handleSubmit}
              loading={proposeChallenge.isPending}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function ProposeVsChallengeScreen(props: ProposeVsChallengeScreenProps) {
  return (
      <ProposeVsChallengeScreenContent {...props} />
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flex: 1, paddingHorizontal: spacing.lg },
    scrollContent: { paddingTop: spacing.lg, paddingBottom: 48 },
    spinner: { marginVertical: spacing.lg },
    submitWrap: { marginTop: spacing.sm },
    opponentRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.card,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
  });
