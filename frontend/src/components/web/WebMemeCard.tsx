import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import WebVotePill from '@/components/web/WebVotePill';
import { FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING, FEED_WEB_TYPE } from '@/constants/webFeedTheme';
import { CommentsSection } from '@/features/feed/components/CommentsSection';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
import { shareMemeImage } from '@/features/sharing/shareMeme';
import type { MemeResponse } from '@/services/memes';
import { useCastVoteMutation, useRecordMemeViewMutation } from '@/services/useMemes';
import { timeAgo } from '@/utils/timeAgo';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface WebMemeCardProps {
  meme: MemeResponse;
}

/**
 * "Dark Cinema" glass card for the web-only feed pilot — same data/hooks as the shared
 * `features/feed/components/MemeCard.tsx` (native-resolved, untouched), entirely new chrome.
 * Nested modals (Send/Comments) are reused as-is rather than reskinned — see FeedScreen.web.tsx
 * report notes for that scope boundary.
 */
export function WebMemeCard({ meme }: WebMemeCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const castVote = useCastVoteMutation();
  const recordView = useRecordMemeViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(meme.id));

  const isVoting = castVote.isPending;

  const onShare = async () => {
    setIsSharing(true);
    setShareError(null);
    try {
      await shareMemeImage(meme.image_url, meme.id);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Could not share this meme.');
    } finally {
      setIsSharing(false);
    }
  };

  const onVote = (value: 1 | -1) => castVote.mutate({ memeId: meme.id, value });

  return (
    <View ref={cardRef} style={styles.card}>
      <View style={styles.header}>
        <WebAvatar username={meme.author.username} avatarUrl={meme.author.avatar_url} size={36} />
        <View style={styles.headerText}>
          <Text style={[FEED_WEB_TYPE.title, styles.heading]}>{meme.author.username}</Text>
          {meme.community ? (
            <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>in {meme.community.name}</Text>
          ) : null}
        </View>
        <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>{timeAgo(meme.created_at)}</Text>
      </View>

      <View style={styles.mediaWrap}>
        <Image
          source={{ uri: meme.image_url }}
          style={styles.media}
          contentFit="cover"
          accessible
          accessibilityRole="image"
          accessibilityLabel={meme.caption ? `Meme: ${meme.caption}` : `Meme posted by ${meme.author.username}`}
        />
      </View>

      <View style={styles.actionsRow}>
        <WebVotePill
          score={meme.score}
          viewerVote={meme.viewer_vote}
          isVoting={isVoting}
          onUpvote={() => onVote(1)}
          onDownvote={() => onVote(-1)}
        />

        <View style={styles.actionsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send to a friend"
            onPress={() => setSendModalOpen(true)}
            style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons name="send" size={20} color={FEED_WEB_COLORS.foregroundMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this meme"
            onPress={onShare}
            disabled={isSharing}
            style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered, isSharing && styles.disabled]}>
            {isSharing ? (
              <ActivityIndicator size="small" color={FEED_WEB_COLORS.foregroundMuted} />
            ) : (
              <MaterialIcons name="ios-share" size={18} color={FEED_WEB_COLORS.foregroundMuted} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle comments"
            onPress={() => setCommentsOpen((open) => !open)}
            style={({ hovered }) => [styles.iconButton, styles.commentButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons name="chat-bubble-outline" size={18} color={FEED_WEB_COLORS.foregroundMuted} />
            <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>{meme.comment_count}</Text>
          </Pressable>
        </View>
      </View>

      {meme.caption ? (
        <Text style={[FEED_WEB_TYPE.body, styles.caption]}>
          <Text style={[FEED_WEB_TYPE.title, styles.heading]}>{meme.author.username} </Text>
          {meme.caption}
        </Text>
      ) : null}

      {meme.view_count !== null ? (
        <View style={styles.viewCountRow}>
          <MaterialIcons name="visibility" size={14} color={FEED_WEB_COLORS.foregroundMuted} />
          <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>
            {meme.view_count} view{meme.view_count === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}

      {castVote.isError ? (
        <Text style={[FEED_WEB_TYPE.meta, styles.errorText]}>{castVote.error?.message}</Text>
      ) : null}

      {shareError ? <Text style={[FEED_WEB_TYPE.meta, styles.errorText]}>{shareError}</Text> : null}

      {commentsOpen ? (
        <View style={styles.commentsWrap}>
          <CommentsSection memeId={meme.id} />
        </View>
      ) : null}

      <SendMemeModal memeId={meme.id} visible={sendModalOpen} onClose={() => setSendModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: FEED_WEB_SPACING.lg,
    borderRadius: FEED_WEB_RADIUS.card,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.border,
    backgroundColor: FEED_WEB_COLORS.surfaceGlass,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.md,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingVertical: FEED_WEB_SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    color: FEED_WEB_COLORS.foreground,
  },
  muted: {
    color: FEED_WEB_COLORS.foregroundMuted,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: FEED_WEB_COLORS.gradientBottom,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.md,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.sm,
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FEED_WEB_RADIUS.pill,
  },
  iconButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  commentButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: FEED_WEB_SPACING.sm,
    gap: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  caption: {
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.sm,
    color: FEED_WEB_COLORS.foreground,
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.xs,
    paddingBottom: FEED_WEB_SPACING.sm,
  },
  errorText: {
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.xs,
    color: FEED_WEB_COLORS.error,
  },
  commentsWrap: {
    marginTop: FEED_WEB_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: FEED_WEB_COLORS.border,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.md,
    paddingBottom: FEED_WEB_SPACING.sm,
  },
});
