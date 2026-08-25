import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebCommunityAvatar from '@/components/web/WebCommunityAvatar';
import { WebCommentsSection } from '@/components/web/WebCommentsSection';
import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE } from '@/constants/webCommunityTheme';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
import type { MemeResponse } from '@/services/memes';
import { useCastVoteMutation, useRecordMemeViewMutation } from '@/services/useMemes';
import { timeAgo } from '@/utils/timeAgo';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface WebCommunityFeedCardProps {
  meme: MemeResponse;
}

/**
 * Meme card for the Community Detail Feed tab — same data/hooks as the shared
 * `features/feed/components/MemeCard.tsx` (native-resolved, untouched) and structurally similar
 * to `feed-web.md`'s `WebMemeCard`, but themed through this page's own Community token structure
 * (`useCommunityWebTheme`), which now carries the same Neon Plum color values as every other web
 * screen (see `webCommunityTheme.ts`) — own structure/typography, shared palette. Drops the "in
 * {community}" byline since every card here is already inside one community. Nested modals
 * (Send/Comments) reused as-is, unreskinned — same accepted scope boundary as the feed pilot.
 */
export function WebCommunityFeedCard({ meme }: WebCommunityFeedCardProps) {
  const router = useRouter();
  const { colors } = useCommunityWebTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const castVote = useCastVoteMutation();
  const recordView = useRecordMemeViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(meme.id));
  const commentsRef = useRef<View>(null);

  const isVoting = castVote.isPending;
  const netScore = meme.score;

  useEffect(() => {
    if (!commentsOpen) return;
    const node = commentsRef.current as unknown as { scrollIntoView?: (opts: ScrollIntoViewOptions) => void } | null;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [commentsOpen]);

  const onVote = (value: 1 | -1) => castVote.mutate({ memeId: meme.id, value });

  return (
    <View ref={cardRef} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${meme.author.username}'s profile`}
          onPress={() => router.push({ pathname: '/users/[id]', params: { id: meme.author.id } })}
          style={styles.headerIdentity}>
          <WebCommunityAvatar label={meme.author.username} imageUrl={meme.author.avatar_url} size={36} />
          <Text style={[COMMUNITY_WEB_TYPE.title, styles.flex, { color: colors.cardForeground }]}>
            {meme.author.username}
          </Text>
        </Pressable>
        <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>{timeAgo(meme.created_at)}</Text>
      </View>

      <View style={[styles.mediaWrap, { backgroundColor: colors.elevated }]}>
        <Image
          source={{ uri: meme.image_url }}
          style={styles.media}
          contentFit="cover"
          accessible
          accessibilityRole="image"
          accessibilityLabel={meme.caption ? `Meme: ${meme.caption}` : `Meme posted by ${meme.author.username}`}
        />
      </View>

      {meme.caption ? (
        <Text style={[COMMUNITY_WEB_TYPE.body, styles.caption, { color: colors.foreground }]}>{meme.caption}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <View style={styles.voteGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upvote"
            accessibilityState={{ selected: meme.viewer_vote === 1, disabled: isVoting }}
            onPress={() => onVote(1)}
            disabled={isVoting}
            style={({ hovered }) => [styles.voteButton, hovered && { backgroundColor: colors.elevatedHover }]}>
            <MaterialIcons
              name="arrow-upward"
              size={18}
              color={meme.viewer_vote === 1 ? colors.accent : colors.foregroundMuted}
            />
          </Pressable>
          <Text style={[COMMUNITY_WEB_TYPE.title, { color: colors.cardForeground, minWidth: 20, textAlign: 'center' }]}>
            {netScore}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Downvote"
            accessibilityState={{ selected: meme.viewer_vote === -1, disabled: isVoting }}
            onPress={() => onVote(-1)}
            disabled={isVoting}
            style={({ hovered }) => [styles.voteButton, hovered && { backgroundColor: colors.elevatedHover }]}>
            <MaterialIcons
              name="arrow-downward"
              size={18}
              color={meme.viewer_vote === -1 ? colors.destructive : colors.foregroundMuted}
            />
          </Pressable>
        </View>

        <View style={styles.actionsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send to a friend"
            onPress={() => setSendModalOpen(true)}
            style={({ hovered }) => [styles.iconButton, hovered && { backgroundColor: colors.elevatedHover }]}>
            <MaterialIcons name="send" size={18} color={colors.shareAccent} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle comments"
            onPress={() => setCommentsOpen((open) => !open)}
            style={({ hovered }) => [styles.iconButton, styles.commentButton, hovered && { backgroundColor: colors.elevatedHover }]}>
            <MaterialIcons name="chat-bubble-outline" size={17} color={colors.foregroundMuted} />
            <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>{meme.comment_count}</Text>
          </Pressable>
        </View>
      </View>

      {castVote.isError ? (
        <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.destructive, paddingHorizontal: COMMUNITY_WEB_SPACING.lg }]}>
          {castVote.error?.message}
        </Text>
      ) : null}
      {commentsOpen ? (
        <View ref={commentsRef} style={[styles.commentsWrap, { borderTopColor: colors.border }]}>
          <WebCommentsSection memeId={meme.id} />
        </View>
      ) : null}

      <SendMemeModal memeId={meme.id} visible={sendModalOpen} onClose={() => setSendModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: COMMUNITY_WEB_SPACING.lg,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.md,
  },
  flex: {
    flex: 1,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  caption: {
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingTop: COMMUNITY_WEB_SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.md,
  },
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.xs,
  },
  voteButton: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  iconButton: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  commentButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    gap: 4,
  },
  commentsWrap: {
    borderTopWidth: 1,
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingTop: COMMUNITY_WEB_SPACING.md,
    paddingBottom: COMMUNITY_WEB_SPACING.sm,
  },
});
