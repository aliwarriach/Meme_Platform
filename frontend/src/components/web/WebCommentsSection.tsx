import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { commentSchema, type CommentFormValues } from '@/features/feed/schemas';
import { useAddCommentMutation, useComments } from '@/services/useMemes';

interface WebCommentsSectionProps {
  memeId: string;
}

/**
 * Theme-aware replacement for the shared native `CommentsSection` inside `WebMemeCard`/
 * `WebCommunityFeedCard` — that component's NativeWind classes (`bg-surface-high`, `text-ink-muted`)
 * are the app's fixed dark-only native palette, so in light mode it rendered a dark-grey input on
 * a light card with a light-pink "Add a comment" label — unreadable. Uses `useVaporwaveTheme()`
 * regardless of which card mounts it (Feed or Community) since the Community token structure's
 * color VALUES are a deliberate literal copy of Vaporwave's, per `webCommunityTheme.ts`'s own
 * header — same palette, so no visible seam even though the community card's own chrome uses its
 * own theme hook elsewhere.
 */
export function WebCommentsSection({ memeId }: WebCommentsSectionProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const commentsQuery = useComments(memeId, true);
  const addComment = useAddCommentMutation(memeId);

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
