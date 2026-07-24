import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CommentsSection } from '@/features/feed/components/CommentsSection';
import { SendMemeModal } from '@/features/meme-sending/SendMemeModal';
import { shareMemeImage } from '@/features/sharing/shareMeme';
import type { MemeResponse } from '@/services/memes';
import { useRecordMemeViewMutation, useCastVoteMutation } from '@/services/useMemes';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface MemeCardProps {
  meme: MemeResponse;
}

export function MemeCard({ meme }: MemeCardProps) {
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
    <View ref={cardRef} className="mb-4 border-b border-neutral-100 pb-4 dark:border-neutral-800">
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
        <View className="mr-4 flex-row items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={meme.viewer_vote === 1 ? 'Remove upvote' : 'Upvote this meme'}
            accessibilityState={{ selected: meme.viewer_vote === 1, disabled: isVoting }}
            onPress={() => onVote(1)}
            disabled={isVoting}
            className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50">
            <Text
              className={
                meme.viewer_vote === 1 ? 'text-orange-500' : 'text-neutral-500 dark:text-neutral-400'
              }>
              ▲
            </Text>
          </Pressable>

          {isVoting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="min-w-[24px] text-center font-semibold text-neutral-900 dark:text-white">
              {meme.score}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={meme.viewer_vote === -1 ? 'Remove downvote' : 'Downvote this meme'}
            accessibilityState={{ selected: meme.viewer_vote === -1, disabled: isVoting }}
            onPress={() => onVote(-1)}
            disabled={isVoting}
            className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50">
            <Text
              className={
                meme.viewer_vote === -1 ? 'text-blue-500' : 'text-neutral-500 dark:text-neutral-400'
              }>
              ▼
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle comments"
          onPress={() => setCommentsOpen((open) => !open)}
          className="mr-4 min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {meme.comment_count} comment{meme.comment_count === 1 ? '' : 's'}
          </Text>
        </Pressable>

        {meme.view_count !== null ? (
          // Visible only when the backend has authorized this viewer (the author, or a
          // community post's community owner) — everyone else gets view_count: null and
          // this is simply omitted, not hidden client-side.
          <View className="mr-4 min-h-[44px] justify-center">
            <Text className="text-neutral-500 dark:text-neutral-400">
              👁 {meme.view_count} view{meme.view_count === 1 ? '' : 's'}
            </Text>
          </View>
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
