import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import { WebCommentsSection } from '@/components/web/WebCommentsSection';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
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
 *
 * Vote control is the circular up/down button pair from `WebCommunityFeedCard` (not the
 * `WebVotePill` "▲score▼" pill this card used before) — unified per explicit user request so the
 * main and community feeds present one consistent voting affordance. `WebVotePill` itself is
 * untouched and still used by `WebContainerCard` (Instagram Companion Mode), out of this scope.
 */
export function WebMemeCard({ meme }: WebMemeCardProps) {
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const castVote = useCastVoteMutation();
  const recordView = useRecordMemeViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(meme.id));
  const commentsRef = useRef<View>(null);
  const { colors: FEED_WEB_COLORS, type: FEED_WEB_TYPE, radius: FEED_WEB_RADIUS, spacing: FEED_WEB_SPACING } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING), [FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING]);

  const isVoting = castVote.isPending;

  useEffect(() => {
    if (!commentsOpen) return;
    const node = commentsRef.current as unknown as { scrollIntoView?: (opts: ScrollIntoViewOptions) => void } | null;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [commentsOpen]);

  const onVote = (value: 1 | -1) => castVote.mutate({ memeId: meme.id, value });

  return (
    <View ref={cardRef} style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${meme.author.username}'s profile`}
          onPress={() => router.push({ pathname: '/users/[id]', params: { id: meme.author.id } })}
          style={styles.headerIdentity}>
          <WebAvatar username={meme.author.username} avatarUrl={meme.author.avatar_url} size={36} />
          <View style={styles.headerText}>
            <Text style={[FEED_WEB_TYPE.title, styles.heading]}>{meme.author.username}</Text>
            {meme.community ? (
              <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>in {meme.community.name}</Text>
            ) : null}
          </View>
        </Pressable>
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
        <View style={styles.voteGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upvote"
            accessibilityState={{ selected: meme.viewer_vote === 1, disabled: isVoting }}
            onPress={() => onVote(1)}
            disabled={isVoting}
            style={({ hovered }) => [styles.voteButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons
              name="arrow-upward"
              size={18}
              color={meme.viewer_vote === 1 ? FEED_WEB_COLORS.accentUpvote : FEED_WEB_COLORS.foregroundMuted}
            />
          </Pressable>
          <Text style={[FEED_WEB_TYPE.title, styles.voteScore]}>{meme.score}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Downvote"
            accessibilityState={{ selected: meme.viewer_vote === -1, disabled: isVoting }}
            onPress={() => onVote(-1)}
            disabled={isVoting}
            style={({ hovered }) => [styles.voteButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons
              name="arrow-downward"
              size={18}
              color={meme.viewer_vote === -1 ? FEED_WEB_COLORS.accentDownvote : FEED_WEB_COLORS.foregroundMuted}
            />
          </Pressable>
        </View>

        <View style={styles.actionsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send to a friend"
            onPress={() => setSendModalOpen(true)}
            style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons name="send" size={20} color={FEED_WEB_COLORS.accentCyan} />
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

      {commentsOpen ? (
        <View ref={commentsRef} style={styles.commentsWrap}>
          <WebCommentsSection memeId={meme.id} />
        </View>
      ) : null}

      <SendMemeModal memeId={meme.id} visible={sendModalOpen} onClose={() => setSendModalOpen(false)} />
    </View>
  );
}

const createStyles = (
  FEED_WEB_COLORS: VaporwaveTheme['colors'],
  FEED_WEB_RADIUS: VaporwaveTheme['radius'],
  FEED_WEB_SPACING: VaporwaveTheme['spacing'],
) => StyleSheet.create({
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
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.md,
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
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.xs,
  },
  voteButton: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  voteScore: {
    minWidth: 28,
    textAlign: 'center',
    color: FEED_WEB_COLORS.foreground,
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
    backgroundColor: FEED_WEB_COLORS.hoverTint,
  },
  commentButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: FEED_WEB_SPACING.sm,
    gap: 4,
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
