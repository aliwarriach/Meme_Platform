import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState, type RefObject } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import VotePill from '@/components/VotePill';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { CommentsSection } from '@/features/feed/components/CommentsSection';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
import { shareMemeImage } from '@/features/sharing/shareMeme';
import type { MemeResponse } from '@/services/memes';
import { useRecordMemeViewMutation, useCastVoteMutation } from '@/services/useMemes';
import { timeAgo } from '@/utils/timeAgo';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface MemeCardProps {
  meme: MemeResponse;
  // Only meaningful inside a FlatList (the feed) — omitted when this card is reused standalone
  // (e.g. CompetitionEntryModal's single-item preview), where there's no list to scroll.
  index?: number;
  listRef?: RefObject<FlatList<any> | null>;
}

/** Bordered card: fixed 4:5 media ratio, avatar+username header, up/down vote control + send/share/comment action row. */
export function MemeCard({ meme, index = 0, listRef }: MemeCardProps) {
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const castVote = useCastVoteMutation();
  const recordView = useRecordMemeViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(meme.id));
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

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
    <View
      ref={cardRef}
      className="mx-3 mb-4 overflow-hidden rounded-card border border-outline-variant/30 bg-surface pb-3">
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${meme.author.username}'s profile`}
          onPress={() => router.push({ pathname: '/users/[id]', params: { id: meme.author.id } })}
          className="flex-1 flex-row items-center">
          <View className="mr-3">
            <Avatar username={meme.author.username} avatarUrl={meme.author.avatar_url} size="sm" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-sm text-heading">{meme.author.username}</Text>
            {meme.community ? (
              <Text className="font-body text-xs text-ink-muted">in {meme.community.name}</Text>
            ) : null}
          </View>
        </Pressable>
        <Text className="font-body text-xs text-ink-muted">{timeAgo(meme.created_at)}</Text>
      </View>

      <Image
        source={{ uri: meme.image_url }}
        style={{ width: '100%', aspectRatio: 4 / 5 }}
        contentFit="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          meme.caption ? `Meme: ${meme.caption}` : `Meme posted by ${meme.author.username}`
        }
      />

      <View className="flex-row items-center justify-between px-4 pt-3">
        <VotePill
          score={meme.score}
          viewerVote={meme.viewer_vote}
          isVoting={isVoting}
          onUpvote={() => onVote(1)}
          onDownvote={() => onVote(-1)}
        />

        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send to a friend"
            onPress={() => setSendModalOpen(true)}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="send" size={22} color={c.inkMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this meme"
            onPress={onShare}
            disabled={isSharing}
            className="h-11 w-11 items-center justify-center disabled:opacity-50">
            {isSharing ? (
              <ActivityIndicator size="small" color={c.inkMuted} />
            ) : (
              <MaterialIcons name="ios-share" size={20} color={c.inkMuted} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle comments"
            onPress={() => setCommentsOpen((open) => !open)}
            className="h-11 flex-row items-center gap-1">
            <MaterialIcons name="chat-bubble-outline" size={20} color={c.inkMuted} />
            <Text className="font-body text-sm text-ink-muted">{meme.comment_count}</Text>
          </Pressable>
        </View>
      </View>

      {meme.caption ? (
        <Text className="px-4 pt-2 font-body text-sm text-ink">
          <Text className="font-title text-heading">{meme.author.username} </Text>
          {meme.caption}
        </Text>
      ) : null}

      {meme.view_count !== null ? (
        // Visible only when the backend has authorized this viewer (the author, or a
        // community post's community owner) — everyone else gets view_count: null and
        // this is simply omitted, not hidden client-side.
        <Text className="px-4 pt-1 font-body text-xs text-ink-muted">
          👁 {meme.view_count} view{meme.view_count === 1 ? '' : 's'}
        </Text>
      ) : null}

      {castVote.isError ? (
        <Text className="px-4 pt-1 font-body text-xs text-error">{castVote.error?.message}</Text>
      ) : null}

      {shareError ? <Text className="px-4 pt-1 font-body text-xs text-error">{shareError}</Text> : null}

      {commentsOpen ? <CommentsSection memeId={meme.id} index={index} listRef={listRef} /> : null}

      <SendMemeModal
        memeId={meme.id}
        visible={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
      />
    </View>
  );
}
