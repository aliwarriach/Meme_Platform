import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { BottomSheet } from '@/components/BottomSheet';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useDeleteMemeMutation } from '@/services/useMemes';

interface PostMenuSheetProps {
  memeId: string;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** False for a community owner managing someone else's post — they can remove it from
   * their community's feed, but never edit content they didn't author. */
  canEdit: boolean;
}

/**
 * Post menu (the three-dot affordance on `MemeCard`'s header): edit and/or delete this
 * post. Shown to the post's own author (both actions) or, for a community post, that
 * community's owner (delete only — moderation, not authorship). Delete requires a second,
 * explicit confirmation step inside the same sheet — it's irreversible from the poster's
 * side (soft-deleted, drops out of every feed/read immediately) so a single misplaced tap
 * must never trigger it.
 */
export function PostMenuSheet({ memeId, visible, onClose, onEdit, canEdit }: PostMenuSheetProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteMeme = useDeleteMemeMutation();

  const handleClose = () => {
    if (deleteMeme.isPending) return;
    setConfirmingDelete(false);
    deleteMeme.reset();
    onClose();
  };

  const onConfirmDelete = async () => {
    try {
      await deleteMeme.mutateAsync(memeId);
      handleClose();
    } catch {
      // surfaced inline via deleteMeme.isError below
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={confirmingDelete ? 38 : 30}>
      <View className="border-t border-outline-variant/30 bg-bg px-2 pb-4">
        {confirmingDelete ? (
          <>
            <Text className="px-4 pb-1 pt-2 font-heading text-lg text-heading">Delete this post?</Text>
            <Text className="px-4 pb-4 font-body text-sm text-ink-muted">
              {canEdit
                ? "This can't be undone. It will disappear from feeds and profiles, but its score stays counted in your leaderboard/profile total and in any challenge it was already submitted to."
                : "This removes it from your community's feed. It can't be undone, but the author's leaderboard/profile score and any challenge it was already submitted to are unaffected."}
            </Text>
            {deleteMeme.isError ? (
              <Text className="px-4 pb-3 font-body text-sm text-error">{deleteMeme.error.message}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm delete post"
              onPress={onConfirmDelete}
              disabled={deleteMeme.isPending}
              className="mx-2 min-h-[44px] flex-row items-center justify-center gap-2 rounded-card bg-error/15 px-4 py-3 disabled:opacity-60">
              {deleteMeme.isPending ? (
                <ActivityIndicator size="small" color={c.error} />
              ) : (
                <MaterialIcons name="delete-outline" size={20} color={c.error} />
              )}
              <Text className="font-title text-base text-error">
                {deleteMeme.isPending ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel delete"
              onPress={() => setConfirmingDelete(false)}
              disabled={deleteMeme.isPending}
              className="mx-2 mt-2 min-h-[44px] items-center justify-center rounded-card px-4 py-3">
              <Text className="font-title text-base text-heading">Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            {canEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit post"
                onPress={() => {
                  onEdit();
                  handleClose();
                }}
                className="min-h-[44px] flex-row items-center gap-3 rounded-card px-4 py-3">
                <MaterialIcons name="edit" size={20} color={c.ink} />
                <Text className="font-title text-base text-heading">Edit</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete post"
              onPress={() => setConfirmingDelete(true)}
              className="min-h-[44px] flex-row items-center gap-3 rounded-card px-4 py-3">
              <MaterialIcons name="delete-outline" size={20} color={c.error} />
              <Text className="font-title text-base text-error">Delete</Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
