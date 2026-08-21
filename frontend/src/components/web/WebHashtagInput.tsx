import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChallengeTagEntry } from '@/features/challenges/components/HashtagInput';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { HashtagSuggestionResponse } from '@/services/hashtags';
import { useChallengeFlat } from '@/services/useChallenges';
import { useHashtagSearch } from '@/services/useHashtags';

export type { ChallengeTagEntry } from '@/features/challenges/components/HashtagInput';

interface WebHashtagInputProps {
  /** Plain discovery tags — never includes the challenge-entry tag, that's tracked separately. */
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  challengeEntry: ChallengeTagEntry | null;
  onChallengeEntryChange: (entry: ChallengeTagEntry | null) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/** Strips leading '#' and lowercases for a stable chip label — same contract as the native
 * `HashtagInput`'s own helper (the backend's `normalize_hashtag` is the real authority). */
function displaySlug(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase();
}

/** Themed replacement for `features/challenges/components/HashtagInput.tsx` — identical props/
 * behavior contract (same `ChallengeTagEntry` type, re-exported here so this file's callers don't
 * need to reach into `features/challenges/` directly), Vaporwave/Luminous chrome. */
export function WebHashtagInput({ tags, onTagsChange, challengeEntry, onChallengeEntryChange }: WebHashtagInputProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  const [draft, setDraft] = useState('');
  const [pendingChallenge, setPendingChallenge] = useState<HashtagSuggestionResponse | null>(null);

  const searchQuery = useHashtagSearch(draft);
  const pendingChallengeQuery = useChallengeFlat(pendingChallenge?.challenge_id ?? '');

  const addPlainTag = (rawSlug: string) => {
    const slug = displaySlug(rawSlug);
    if (!slug || tags.includes(slug)) return;
    onTagsChange([...tags, slug]);
  };

  const onSelectSuggestion = (suggestion: HashtagSuggestionResponse) => {
    setDraft('');
    if (suggestion.challenge_id) {
      setPendingChallenge(suggestion);
    } else {
      addPlainTag(suggestion.slug);
    }
  };

  const onSubmitDraft = () => {
    const slug = displaySlug(draft);
    if (!slug) return;
    const matchingChallenge = (searchQuery.data ?? []).find((s) => s.slug === slug && s.challenge_id);
    if (matchingChallenge) {
      onSelectSuggestion(matchingChallenge);
    } else {
      addPlainTag(slug);
      setDraft('');
    }
  };

  const onPickSide = (sideId: string, sideName: string) => {
    if (!pendingChallenge) return;
    onChallengeEntryChange({
      challengeId: pendingChallenge.challenge_id!,
      challengeTitle: pendingChallenge.challenge_title ?? pendingChallenge.display_text,
      sideId,
      sideName,
      tagSlug: pendingChallenge.slug,
    });
    setPendingChallenge(null);
  };

  const removeTag = (slug: string) => {
    if (challengeEntry?.tagSlug === slug) {
      onChallengeEntryChange(null);
    } else {
      onTagsChange(tags.filter((t) => t !== slug));
    }
  };

  const allChips = challengeEntry ? [challengeEntry.tagSlug, ...tags] : tags;
  const suggestions = draft.trim() ? (searchQuery.data ?? []) : [];

  return (
    <View style={styles.root}>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>Tags (optional)</Text>

      {allChips.length > 0 ? (
        <View style={styles.chipRow}>
          {allChips.map((slug) => {
            const isChallenge = slug === challengeEntry?.tagSlug;
            return (
              <Pressable
                key={slug}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${slug}`}
                onPress={() => removeTag(slug)}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.chip,
                  isChallenge
                    ? { backgroundColor: colors.accentGold, borderColor: colors.accentGold }
                    : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                  hovered && { opacity: 0.9 },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <Text style={[type.label, { color: isChallenge ? colors.onAccentInk : colors.foregroundMuted }]}>
                  {isChallenge ? `🏆 #${slug}` : `#${slug}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {pendingChallenge ? (
        <View style={[styles.pendingCard, { borderColor: colors.indigoSecondary, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[type.body, { color: colors.foreground, marginBottom: spacing.sm }]}>
            #{pendingChallenge.slug} enters{' '}
            <Text style={[type.title, { color: colors.foreground }]}>{pendingChallenge.challenge_title}</Text> — which side?
          </Text>
          {pendingChallengeQuery.isLoading ? (
            <ActivityIndicator size="small" color={colors.foregroundMuted} />
          ) : pendingChallengeQuery.isError ? (
            <Text style={[type.meta, { color: colors.error }]}>Couldn&apos;t load this challenge&apos;s sides.</Text>
          ) : (
            <View style={styles.chipRow}>
              {(pendingChallengeQuery.data?.sides ?? []).map((side) => (
                <Pressable
                  key={side.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Enter on ${side.name}`}
                  onPress={() => onPickSide(side.id, side.name)}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.chip,
                    { backgroundColor: colors.surfaceSolid, borderColor: colors.borderSolid },
                    hovered && { backgroundColor: colors.surfaceHover },
                    focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                  ]}>
                  <Text style={[type.label, { color: colors.foreground }]}>{side.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => setPendingChallenge(null)}
            style={styles.cancelButton}>
            <Text style={[type.meta, { color: colors.foregroundMuted }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={onSubmitDraft}
            placeholder="#dogsvscats"
            placeholderTextColor={colors.foregroundMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Add a hashtag"
            style={[
              type.body,
              styles.input,
              { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
            ]}
          />
          {searchQuery.isError ? (
            <Text style={[type.meta, { color: colors.error, marginTop: spacing.xs }]}>Couldn&apos;t search tags right now.</Text>
          ) : suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tag #${suggestion.slug}`}
                  onPress={() => onSelectSuggestion(suggestion)}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.suggestionRow,
                    { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
                    hovered && { backgroundColor: colors.surfaceHover },
                    focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                  ]}>
                  <Text style={[type.body, { color: colors.foreground }]}>#{suggestion.slug}</Text>
                  {suggestion.challenge_title ? (
                    <Text style={[type.meta, { color: colors.indigoPrimary }]}>enters: {suggestion.challenge_title}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      marginBottom: spacing.lg,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    chip: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
    },
    pendingCard: {
      marginBottom: spacing.sm,
      borderRadius: radius.card,
      borderWidth: 1.5,
      padding: spacing.md,
    },
    cancelButton: {
      minHeight: 32,
      marginTop: spacing.sm,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    input: {
      minHeight: 44,
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    suggestions: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    suggestionRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.chip,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  });
