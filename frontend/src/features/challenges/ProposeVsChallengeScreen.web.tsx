import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebCompeteTopBar from '@/components/web/WebCompeteTopBar';
import { WebDurationPresets } from '@/components/web/WebDurationPresets';
import { CompeteThemeProvider, useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';
import { useDiscoverCommunities } from '@/services/useCommunities';
import { useProposeVsChallengeMutation } from '@/services/useChallenges';

interface ProposeVsChallengeScreenProps {
  communityId: string;
}

const DEFAULT_DURATION_MINUTES = 30;

/** Web-only sibling of `features/challenges/ProposeVsChallengeScreen.tsx` (native-resolved,
 * untouched). See compete-web.md's "UX improvements" for the shared `WebDurationPresets`
 * addition. The opponent-community picker is a small local row (single consumer, not extracted
 * to `components/web/` per this codebase's own "extract on 2nd occurrence" convention). */
function ProposeVsChallengeScreenContent({ communityId }: ProposeVsChallengeScreenProps) {
  const router = useRouter();
  const { colors } = useCompeteWebTheme();
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebCompeteTopBar title="Challenge a Community" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[COMPETE_WEB_TYPE.body, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.lg }]}>
            The other community&apos;s owner must accept before the challenge starts.
          </Text>

          <WebCompeteTextField label="Title" value={title} onChangeText={setTitle} placeholder="Community Showdown" />

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

          <Text style={[COMPETE_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.sm }]}>
            Select Opponent
          </Text>
          {discoverQuery.isLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
          ) : discoverQuery.isError ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.destructiveText }]}>{discoverQuery.error?.message}</Text>
          ) : opponents.length === 0 ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.lg }]}>
              No other communities to challenge yet
            </Text>
          ) : (
            <View style={{ marginBottom: COMPETE_WEB_SPACING.lg }}>
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
                      { backgroundColor: colors.card, borderColor: colors.border },
                      // Selection signal is the outline border only, background stays `card` —
                      // `elevated` is reserved for cardForeground/icon-only pairings (see
                      // compete-web.md's Accessibility audit); this row's `primaryText` title and
                      // `foregroundMuted` member-count both measure under AA against `elevated`.
                      selected && { borderColor: colors.outline, borderWidth: 2 },
                      hovered && !selected && { backgroundColor: colors.elevatedHover },
                      focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
                    ]}>
                    <View>
                      <Text style={[COMPETE_WEB_TYPE.title, { color: selected ? colors.primaryText : colors.cardForeground }]}>
                        {community.name}
                      </Text>
                      <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
                        {community.member_count} member{community.member_count === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {formError ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.destructiveText, marginBottom: COMPETE_WEB_SPACING.sm }]}>
              {formError}
            </Text>
          ) : null}
          {proposeChallenge.isError ? (
            <Text style={[COMPETE_WEB_TYPE.body, { color: colors.destructiveText, marginBottom: COMPETE_WEB_SPACING.sm }]}>
              {proposeChallenge.error?.message}
            </Text>
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
    <CompeteThemeProvider>
      <ProposeVsChallengeScreenContent {...props} />
    </CompeteThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1, paddingHorizontal: COMPETE_WEB_SPACING.lg },
  scrollContent: { paddingTop: COMPETE_WEB_SPACING.lg, paddingBottom: 48 },
  spinner: { marginVertical: COMPETE_WEB_SPACING.lg },
  submitWrap: { marginTop: COMPETE_WEB_SPACING.sm },
  opponentRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: COMPETE_WEB_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: COMPETE_WEB_SPACING.md,
    paddingVertical: COMPETE_WEB_SPACING.sm,
    marginBottom: COMPETE_WEB_SPACING.sm,
  },
});
