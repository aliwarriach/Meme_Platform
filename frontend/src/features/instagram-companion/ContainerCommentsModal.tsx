import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { TextField } from '@/components/TextField';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { commentSchema, type CommentFormValues } from '@/features/feed/schemas';
import type { ContainerCommentResponse } from '@/services/instagram';
import { useAddContainerCommentMutation, useContainerComments } from '@/services/useInstagram';

interface ContainerCommentsModalProps {
  containerId: string;
  visible: boolean;
  onClose: () => void;
}

/** Same sheet-based redesign as `CommentsModal` (see its doc comment for why) — Instagram
 * Companion Mode's `MemeContainer`s carry their own comments, kept structurally identical. */
export function ContainerCommentsModal({ containerId, visible, onClose }: ContainerCommentsModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const commentsQuery = useContainerComments(containerId, visible);
  const addComment = useAddContainerCommentMutation(containerId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addComment.mutateAsync(values.body);
      reset({ body: '' });
    } catch {
      // surfaced inline via addComment.isError below
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPercent={85}>
      <View className="flex-1 border-t border-outline-variant/30 bg-bg">
        <View className="flex-row items-center justify-between px-4 pb-3">
          <Text className="font-heading text-lg text-heading">Comments</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        {commentsQuery.isLoading ? (
          <ActivityIndicator className="my-4" color={c.inkMuted} />
        ) : commentsQuery.isError ? (
          <Text className="px-4 font-body text-sm text-error">{commentsQuery.error.message}</Text>
        ) : (
          <FlatList<ContainerCommentResponse>
            data={commentsQuery.data ?? []}
            keyExtractor={(item) => item.id}
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            renderItem={({ item }) => (
              <View className="mb-3 flex-row items-start gap-2">
                <Avatar
                  username={item.author.username}
                  avatarUrl={item.author.avatar_url}
                  avatarPreset={item.author.avatar_preset}
                  size="sm"
                />
                <Text className="flex-1 font-body text-sm text-ink">
                  <Text className="font-title text-heading">{item.author.username} </Text>
                  {item.body}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text className="px-1 py-4 font-body text-sm text-ink-muted">
                No comments yet — be the first.
              </Text>
            }
          />
        )}

        <View className="border-t border-outline-variant/30 px-4 pt-3">
          <View className="flex-row items-end gap-2">
            <View className="mr-2 flex-1">
              <Controller
                control={control}
                name="body"
                render={({ field }) => (
                  <TextField
                    label="Add a comment"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={errors.body?.message}
                    autoFocus
                  />
                )}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              onPress={onSubmit}
              disabled={addComment.isPending}
              className="mb-6 min-h-[44px] items-center justify-center rounded-full bg-primary-container px-5 py-3 disabled:opacity-50">
              <Text className="font-title text-sm text-white">
                {addComment.isPending ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          </View>
          {addComment.isError ? (
            <Text className="mb-2 font-body text-sm text-error">{addComment.error.message}</Text>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}
