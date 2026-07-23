import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { commentSchema, type CommentFormValues } from '@/features/feed/schemas';
import { useAddContainerCommentMutation, useContainerComments } from '@/services/useInstagram';

interface ContainerCommentsSectionProps {
  containerId: string;
}

export function ContainerCommentsSection({ containerId }: ContainerCommentsSectionProps) {
  const commentsQuery = useContainerComments(containerId, true);
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
    <View className="mt-2 px-4">
      {commentsQuery.isLoading ? (
        <ActivityIndicator className="my-2" />
      ) : commentsQuery.isError ? (
        <Text className="text-sm text-red-500">{commentsQuery.error.message}</Text>
      ) : (
        commentsQuery.data?.map((comment) => (
          <View key={comment.id} className="mb-1.5">
            <Text className="text-sm text-neutral-900 dark:text-neutral-100">
              <Text className="font-semibold">{comment.author.username}</Text> {comment.body}
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
              />
            )}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          onPress={onSubmit}
          disabled={addComment.isPending}
          className="mb-6 min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 disabled:opacity-50">
          <Text className="text-sm font-bold text-white">
            {addComment.isPending ? 'Posting…' : 'Post'}
          </Text>
        </Pressable>
      </View>
      {addComment.isError ? (
        <Text className="mb-2 text-sm text-red-500">{addComment.error.message}</Text>
      ) : null}
    </View>
  );
}
