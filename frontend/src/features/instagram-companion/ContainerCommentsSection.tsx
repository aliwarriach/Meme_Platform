import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type RefObject } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Keyboard, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { TextField } from '@/components/TextField';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { commentSchema, type CommentFormValues } from '@/features/feed/schemas';
import { useAddContainerCommentMutation, useContainerComments } from '@/services/useInstagram';

interface ContainerCommentsSectionProps {
  containerId: string;
  index?: number;
  listRef?: RefObject<FlatList<any> | null>;
}

export function ContainerCommentsSection({ containerId, index, listRef }: ContainerCommentsSectionProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const commentsQuery = useContainerComments(containerId, true);
  const addComment = useAddContainerCommentMutation(containerId);

  // See CommentsSection.tsx (feed) for why this listens for keyboardDidShow rather than
  // scrolling on tap: the scroll needs to happen after the KeyboardAvoidingView has actually
  // shrunk the list, not before.
  useEffect(() => {
    if (!listRef) return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      listRef.current?.scrollToIndex({ index: index ?? 0, animated: true, viewPosition: 1 });
    });
    return () => sub.remove();
  }, [index, listRef]);

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
    <View className="mt-2 border-t border-outline-variant/30 px-4 pt-3">
      {commentsQuery.isLoading ? (
        <ActivityIndicator className="my-2" color={c.inkMuted} />
      ) : commentsQuery.isError ? (
        <Text className="font-body text-sm text-error">{commentsQuery.error.message}</Text>
      ) : (
        commentsQuery.data?.map((comment) => (
          <View key={comment.id} className="mb-3 flex-row items-start gap-2">
            <Avatar username={comment.author.username} size="sm" />
            <Text className="flex-1 font-body text-sm text-ink">
              <Text className="font-title text-heading">{comment.author.username} </Text>
              {comment.body}
            </Text>
          </View>
        ))
      )}

      <View className="mt-1 flex-row items-end">
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
  );
}
