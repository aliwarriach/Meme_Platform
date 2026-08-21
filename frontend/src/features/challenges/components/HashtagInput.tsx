import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import Chip from '@/components/Chip';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { HashtagSuggestionResponse } from '@/services/hashtags';
import { useHashtagSearch } from '@/services/useHashtags';
import { useChallengeFlat } from '@/services/useChallenges';

export interface ChallengeTagEntry {
  challengeId: string;
  challengeTitle: string;
  sideId: string;
  sideName: string;
  tagSlug: string;
}

interface HashtagInputProps {
  /** Plain discovery tags — never includes the challenge-entry tag, that's tracked separately. */
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  challengeEntry: ChallengeTagEntry | null;
  onChallengeEntryChange: (entry: ChallengeTagEntry | null) => void;
}

/** Strips leading '#' and lowercases for a stable chip label — the backend's own
 * `normalize_hashtag` is the real authority, this just keeps the UI consistent. */
function displaySlug(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase();
}

export function HashtagInput({ tags, onTagsChange, challengeEntry, onChallengeEntryChange }: HashtagInputProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
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
      // Required side-picker before this becomes a real entry — never silently treated as
      // a submission just because the text matched.
      setPendingChallenge(suggestion);
    } else {
      addPlainTag(suggestion.slug);
    }
  };

  const onSubmitDraft = () => {
    const slug = displaySlug(draft);
    if (!slug) return;
    const matchingChallenge = (searchQuery.data ?? []).find(
      (s) => s.slug === slug && s.challenge_id
    );
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
  const suggestions = draft.trim() ? searchQuery.data ?? [] : [];

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-label text-xs uppercase tracking-wide text-ink-muted">
        Tags (optional)
      </Text>

      {allChips.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {allChips.map((slug) => (
            <Chip
              key={slug}
              label={slug === challengeEntry?.tagSlug ? `🏆 #${slug}` : `#${slug}`}
              selected={slug === challengeEntry?.tagSlug}
              accessibilityLabel={`Remove tag ${slug}`}
              onPress={() => removeTag(slug)}
            />
          ))}
        </View>
      ) : null}

      {pendingChallenge ? (
        <View className="mb-2 rounded-card border border-primary/40 bg-primary/10 p-3">
          <Text className="mb-2 font-body text-sm text-ink">
            #{pendingChallenge.slug} enters <Text className="font-title">{pendingChallenge.challenge_title}</Text> — which side?
          </Text>
          {pendingChallengeQuery.isLoading ? (
            <ActivityIndicator size="small" color={c.inkMuted} />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {(pendingChallengeQuery.data?.sides ?? []).map((side) => (
                <Chip key={side.id} label={side.name} onPress={() => onPickSide(side.id, side.name)} />
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => setPendingChallenge(null)}
            className="mt-2 min-h-[32px] items-start justify-center">
            <Text className="font-label text-xs text-ink-muted">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={onSubmitDraft}
            placeholder="#dogsvscats"
            placeholderTextColor={c.outline}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            className="min-h-[44px] rounded-full border border-outline-variant bg-surface-high/60 px-5 py-3 font-body text-base text-heading"
          />
          {suggestions.length > 0 ? (
            <View className="mt-2 gap-1">
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tag #${suggestion.slug}`}
                  onPress={() => onSelectSuggestion(suggestion)}
                  className="min-h-[44px] flex-row items-center justify-between rounded-card border border-outline-variant/30 bg-surface px-3 py-2">
                  <Text className="font-body text-sm text-ink">#{suggestion.slug}</Text>
                  {suggestion.challenge_title ? (
                    <Text className="font-label text-xs text-primary-dim">
                      enters: {suggestion.challenge_title}
                    </Text>
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
