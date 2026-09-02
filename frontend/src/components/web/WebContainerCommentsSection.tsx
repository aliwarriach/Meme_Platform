import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { commentSchema, type CommentFormValues } from '@/features/feed/schemas';
import { useAddContainerCommentMutation, useContainerComments } from '@/services/useInstagram';

interface WebContainerCommentsSectionProps {
  containerId: string;
}

/**
 * Theme-aware container-comments equivalent of `WebCommentsSection.tsx` (see that file's doc
 * comment for why a dedicated web version exists — the shared native component's fixed dark-only
 * NativeWind classes render unreadable in light mode). Scoped to Instagram Companion Mode
 * containers instead of memes.
 */
export function WebContainerCommentsSection({ containerId }: WebContainerCommentsSectionProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
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
    <View>
      {commentsQuery.isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
      ) : commentsQuery.isError ? (
        <Text style={[type.body, { color: colors.error }]}>{commentsQuery.error.message}</Text>
      ) : (
        commentsQuery.data?.map((comment) => (
          <View key={comment.id} style={styles.commentRow}>
            <WebAvatar username={comment.author.username} size={26} />
            <Text style={[type.body, styles.commentText, { color: colors.foreground }]}>
              <Text style={[type.title, { color: colors.foreground }]}>{comment.author.username} </Text>
              {comment.body}
            </Text>
          </View>
        ))
      )}

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: 4 }]}>Add a comment</Text>
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Add a comment"
                placeholderTextColor={colors.foregroundMuted}
                style={[
                  type.body,
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: errors.body ? colors.error : colors.borderSolid,
                  },
                ]}
              />
            )}
          />
          {errors.body ? <Text style={[type.meta, { color: colors.error, marginTop: 4 }]}>{errors.body.message}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          onPress={onSubmit}
          disabled={addComment.isPending}
          style={({ hovered }) => [
            styles.postButton,
            { backgroundColor: colors.indigoSecondary },
            hovered && !addComment.isPending && styles.postButtonHovered,
            addComment.isPending && styles.disabled,
          ]}>
          <Text style={[type.title, { color: colors.onAccent }]}>{addComment.isPending ? 'Posting…' : 'Post'}</Text>
        </Pressable>
      </View>

      {addComment.isError ? (
        <Text style={[type.meta, { color: colors.error, marginTop: spacing.xs }]}>{addComment.error?.message}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    spinner: {
      marginVertical: spacing.sm,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    commentText: {
      flex: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    inputWrap: {
      flex: 1,
    },
    input: {
      minHeight: 44,
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    postButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
    },
    postButtonHovered: {
      opacity: 0.9,
    },
    disabled: {
      opacity: 0.5,
    },
  });
