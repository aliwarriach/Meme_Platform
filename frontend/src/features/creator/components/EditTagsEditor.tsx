import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Chip from '@/components/Chip';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

interface EditTagsEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

function displaySlug(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase();
}

/**
 * Plain tag chip editor for the meme-edit flow — deliberately simpler than
 * `HashtagInput` (no autocomplete, no challenge-tag side-picker): editing an already-
 * published post's tags never re-enters it into a challenge, so surfacing that resolution
 * UI here would be a dead end (pick a side, nothing happens).
 */
export function EditTagsEditor({ tags, onTagsChange }: EditTagsEditorProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const slug = displaySlug(draft);
    setDraft('');
    if (!slug || tags.includes(slug)) return;
    onTagsChange([...tags, slug]);
  };

  const removeTag = (slug: string) => onTagsChange(tags.filter((t) => t !== slug));

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-label text-xs uppercase tracking-wide text-ink-muted">
        Tags (optional)
      </Text>

      {tags.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {tags.map((slug) => (
            <Chip
              key={slug}
              label={`#${slug}`}
              accessibilityLabel={`Remove tag ${slug}`}
              onPress={() => removeTag(slug)}
            />
          ))}
        </View>
      ) : null}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
        placeholder="#dogsvscats"
        placeholderTextColor={c.outline}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        className="min-h-[44px] rounded-full border border-outline-variant bg-surface-high/60 px-5 py-3 font-body text-base text-heading"
      />
    </View>
  );
}
