import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebEditTagsEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

function displaySlug(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase();
}

/**
 * Web/Vaporwave sibling of `features/creator/components/EditTagsEditor.tsx` — plain tag
 * chip editor for the meme-edit flow, deliberately simpler than `WebHashtagInput` (no
 * autocomplete, no challenge-tag side-picker): editing an already-published post's tags
 * never re-enters it into a challenge.
 */
export function WebEditTagsEditor({ tags, onTagsChange }: WebEditTagsEditorProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const slug = displaySlug(draft);
    setDraft('');
    if (!slug || tags.includes(slug)) return;
    onTagsChange([...tags, slug]);
  };

  const removeTag = (slug: string) => onTagsChange(tags.filter((t) => t !== slug));

  return (
    <View style={styles.root}>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>Tags (optional)</Text>

      {tags.length > 0 ? (
        <View style={styles.chipRow}>
          {tags.map((slug) => (
            <Pressable
              key={slug}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${slug}`}
              onPress={() => removeTag(slug)}
              style={({ hovered, focused }: WebPressableState) => [
                styles.chip,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                hovered && { opacity: 0.9 },
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
              ]}>
              <Text style={[type.label, { color: colors.foregroundMuted }]}>#{slug}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
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
    input: {
      minHeight: 44,
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
  });
