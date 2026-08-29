import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { BottomSheet } from '@/components/BottomSheet';
import PillButton from '@/components/PillButton';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useUpdateBioMutation } from '@/services/useAuth';

interface EditBioModalProps {
  visible: boolean;
  onClose: () => void;
  bio: string | null;
}

const MAX_BIO_CHARS = 150;
const MAX_BIO_LINES = 7;

/** Clamps to both caps at once: `\n`-separated segments beyond the 7th are dropped (so
 * pressing Enter on a full 7th line is a no-op instead of starting an 8th), and the whole
 * string is hard-capped at 150 characters either way. */
function clampBio(text: string): string {
  const truncated = text.slice(0, MAX_BIO_CHARS);
  const lines = truncated.split('\n');
  return lines.length > MAX_BIO_LINES ? lines.slice(0, MAX_BIO_LINES).join('\n') : truncated;
}

/** Instagram-style bio editor: plain multiline text, capped at 150 characters and 7 lines
 * (further Enter presses on a full 7th line are absorbed rather than starting an 8th).
 * Visible on every profile view (not just to friends) — see `ProfileScreen.tsx`. */
export function EditBioModal({ visible, onClose, bio }: EditBioModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [draft, setDraft] = useState(bio ?? '');
  const updateBio = useUpdateBioMutation();

  // Re-sync the draft to the current server value each time the sheet transitions to open
  // (not on every `bio` change — that would clobber in-progress typing if the profile query
  // refetches mid-edit). Adjusted during render rather than in an effect, per React's own
  // guidance for resetting state on a prop change — avoids the extra render an effect-based
  // setState would cause.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(bio ?? '');
  }

  const trimmed = draft.trim();
  const unchanged = trimmed === (bio ?? '');

  const onSave = () => {
    updateBio.mutate(trimmed ? { kind: 'set', bio: trimmed } : { kind: 'clear' }, {
      onSuccess: onClose,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPercent={55}>
      <View className="border-t border-outline-variant/30 bg-bg p-4 pb-8">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-heading text-lg text-heading">Bio</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        <TextInput
          value={draft}
          onChangeText={(text) => setDraft(clampBio(text))}
          placeholder="Write a short bio…"
          placeholderTextColor={c.outline}
          multiline
          maxLength={MAX_BIO_CHARS}
          accessibilityLabel="Bio"
          textAlignVertical="top"
          className="min-h-[120px] rounded-card border border-outline-variant bg-surface-high/60 px-4 py-3 font-body text-sm text-heading"
        />
        <Text className="mt-1.5 self-end font-body text-xs text-ink-muted">
          {draft.length}/{MAX_BIO_CHARS}
        </Text>

        {updateBio.isError ? (
          <Text className="mt-1 font-body text-xs text-error">{updateBio.error.message}</Text>
        ) : null}

        <PillButton
          label={updateBio.isPending ? 'Saving…' : 'Save'}
          onPress={onSave}
          disabled={unchanged || updateBio.isPending}
          loading={updateBio.isPending}
          className="mt-4"
        />
      </View>
    </BottomSheet>
  );
}
