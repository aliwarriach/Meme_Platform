import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CommentsSection } from '@/features/feed/components/CommentsSection';
import type { MemeResponse } from '@/services/memes';
import { useAddReactionMutation, useRemoveReactionMutation } from '@/services/useMemes';

interface MemeCardProps {
  meme: MemeResponse;
}

export function MemeCard({ meme }: MemeCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const addReaction = useAddReactionMutation();
  const removeReaction = useRemoveReactionMutation();

  const isReacting = addReaction.isPending || removeReaction.isPending;

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
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-orange-500">
          <Text className="text-xs font-bold text-white">
            {meme.author.username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text className="font-semibold text-neutral-900 dark:text-white">
          {meme.author.username}
        </Text>
      </View>

      <Image
        source={{ uri: meme.image_url }}
        style={{ width: '100%', aspectRatio: 1 }}
        contentFit="cover"
      />

      {meme.caption ? (
        <Text className="px-4 pt-2 text-neutral-900 dark:text-neutral-100">{meme.caption}</Text>
      ) : null}

      <View className="flex-row items-center px-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meme.viewer_has_reacted ? 'Remove reaction' : 'React to this meme'}
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
          className="min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {meme.comment_count} comment{meme.comment_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </View>

      {commentsOpen ? <CommentsSection memeId={meme.id} /> : null}
    </View>
  );
}
