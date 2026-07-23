import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { CommentsSection } from '@/features/feed/components/CommentsSection';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
import { shareMemeImage } from '@/features/sharing/shareMeme';
import type { MemeResponse } from '@/services/memes';
import { useCastVoteMutation } from '@/services/useCompetitions';
import { useAddReactionMutation, useRemoveReactionMutation } from '@/services/useMemes';
import type { RootState } from '@/store/store';

interface MemeCardProps {
  meme: MemeResponse;
}

export function MemeCard({ meme }: MemeCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const addReaction = useAddReactionMutation();
  const removeReaction = useRemoveReactionMutation();
  // Meme of the Day competition vote — separate mechanic from reactions (§9): one vote
  // per meme per day, cast right from the feed instead of only from the standings screen,
  // since that screen has no way to surface a meme nobody has voted on yet.
  const castVote = useCastVoteMutation('day');

  const isReacting = addReaction.isPending || removeReaction.isPending;
  const isOwnMeme = meme.author.id === currentUser?.id;
  // Voting is unlimited across different memes within a period — the only restriction is
  // one vote per meme per period (DB-enforced server-side) — never for your own meme.
  const isVotable = meme.audiences.includes('public') && !isOwnMeme;

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

  const onToggleReaction = () => {
    if (meme.viewer_has_reacted) {
      removeReaction.mutate(meme.id);
    } else {
      addReaction.mutate(meme.id);
    }
  };

  return (
    <View className="mb-4 border-b border-neutral-100 pb-4 dark:border-neutral-800">
      <View className="flex-row items-center px-4 py-2">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-orange-500">
          <Text className="text-xs font-bold text-white">
            {meme.author.username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className="font-semibold text-neutral-900 dark:text-white">
            {meme.author.username}
          </Text>
          {meme.community ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              in {meme.community.name}
            </Text>
          ) : null}
        </View>
      </View>

      <Image
        source={{ uri: meme.image_url }}
        style={{ width: '100%', aspectRatio: 1 }}
        contentFit="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          meme.caption ? `Meme: ${meme.caption}` : `Meme posted by ${meme.author.username}`
        }
      />

      {meme.caption ? (
        <Text className="px-4 pt-2 text-neutral-900 dark:text-neutral-100">{meme.caption}</Text>
      ) : null}

      <View className="flex-row items-center px-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meme.viewer_has_reacted ? 'Remove reaction' : 'React to this meme'}
          accessibilityState={{ selected: meme.viewer_has_reacted, disabled: isReacting }}
          onPress={onToggleReaction}
          disabled={isReacting}
          className="mr-4 min-h-[44px] flex-row items-center disabled:opacity-50">
          {isReacting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text
              className={
                meme.viewer_has_reacted
                  ? 'text-orange-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }>
              {meme.viewer_has_reacted ? '♥' : '♡'} {meme.reaction_count}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle comments"
          onPress={() => setCommentsOpen((open) => !open)}
          className="mr-4 min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {meme.comment_count} comment{meme.comment_count === 1 ? '' : 's'}
          </Text>
        </Pressable>

        {isVotable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vote for Meme of the Day"
            accessibilityState={{
              selected: castVote.isSuccess,
              disabled: castVote.isPending || castVote.isSuccess,
            }}
            onPress={() => castVote.mutate(meme.id)}
            disabled={castVote.isPending || castVote.isSuccess}
            className="mr-4 min-h-[44px] flex-row items-center disabled:opacity-50">
            {castVote.isPending ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text
                className={
                  castVote.isSuccess ? 'text-orange-500' : 'text-neutral-500 dark:text-neutral-400'
                }>
                🏆 {castVote.isSuccess ? 'Voted' : 'Vote'}
              </Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send to a friend"
          onPress={() => setSendModalOpen(true)}
          className="mr-4 min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">↗ Send</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share this meme"
          onPress={onShare}
          disabled={isSharing}
          className="min-h-[44px] flex-row items-center disabled:opacity-50">
          {isSharing ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="text-neutral-500 dark:text-neutral-400">⤴ Share</Text>
          )}
        </Pressable>
      </View>

      {castVote.isError ? (
        <Text className="px-4 pt-1 text-xs text-red-500">{castVote.error?.message}</Text>
      ) : null}

      {shareError ? (
        <Text className="px-4 pt-1 text-xs text-red-500">{shareError}</Text>
      ) : null}

      {commentsOpen ? <CommentsSection memeId={meme.id} /> : null}

      <SendMemeModal
        memeId={meme.id}
        visible={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
      />
    </View>
  );
}
