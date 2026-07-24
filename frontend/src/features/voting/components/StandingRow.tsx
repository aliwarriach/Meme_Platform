import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { StandingEntryResponse } from '@/services/competitions';

interface StandingRowProps {
  entry: StandingEntryResponse;
}

export function StandingRow({ entry }: StandingRowProps) {
  const { content } = entry;
  const isContainer = content.kind === 'container';
  const imageUrl = isContainer ? content.container.thumbnail_url : content.meme.image_url;
  const authorName = isContainer ? content.container.submitter.username : content.meme.author.username;
  const caption = isContainer ? content.container.title : content.meme.caption;

  return (
    <View className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
      <Text className="w-8 text-sm font-bold text-neutral-400">{entry.rank}</Text>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 56, height: 56, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <Text className="text-xs text-neutral-400">IG</Text>
        </View>
      )}
      <View className="mx-3 flex-1">
        <Text className="font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
          {authorName}
        </Text>
        {caption ? (
          <Text
            className="text-xs text-neutral-500 dark:text-neutral-400"
            numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <Text className="text-sm font-bold text-orange-500">{entry.score}</Text>
    </View>
  );
}
