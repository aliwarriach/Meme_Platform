import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { StandingEntryResponse } from '@/services/competitions';

interface StandingRowProps {
  entry: StandingEntryResponse;
  onVote: () => void;
  isVoting: boolean;
  isOwnMeme: boolean;
}

export function StandingRow({ entry, onVote, isVoting, isOwnMeme }: StandingRowProps) {
  const { meme } = entry;

  return (
    <View className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
      <Text className="w-8 text-sm font-bold text-neutral-400">{entry.rank}</Text>
      <Image
        source={{ uri: meme.image_url }}
        style={{ width: 56, height: 56, borderRadius: 8 }}
        contentFit="cover"
      />
      <View className="mx-3 flex-1">
        <Text className="font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
          {meme.author.username}
        </Text>
        {meme.caption ? (
          <Text
            className="text-xs text-neutral-500 dark:text-neutral-400"
            numberOfLines={1}>
            {meme.caption}
          </Text>
        ) : null}
        <Text className="text-xs text-neutral-400">
          {entry.vote_count} vote{entry.vote_count === 1 ? '' : 's'}
        </Text>
      </View>
      {isOwnMeme ? (
        <Text className="text-xs text-neutral-400">Your meme</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vote for this meme"
          onPress={onVote}
          disabled={isVoting}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 disabled:opacity-50">
          {isVoting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="font-bold text-white">Vote</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
