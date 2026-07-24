import { Image } from 'expo-image';
import { ActivityIndicator, Text, View } from 'react-native';

import type { WinnerResponse } from '@/services/competitions';

interface WinnerBannerProps {
  winner: WinnerResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  label: string;
}

export function WinnerBanner({ winner, isLoading, isError, label }: WinnerBannerProps) {
  const content = winner?.content;
  const imageUrl =
    content?.kind === 'container' ? content.container.thumbnail_url : content?.meme.image_url;
  const authorName =
    content?.kind === 'container' ? content.container.submitter.username : content?.meme.author.username;

  return (
    <View className="mx-4 mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
      <Text className="mb-2 text-xs font-bold uppercase text-orange-600 dark:text-orange-400">
        {label}
      </Text>
      {isLoading ? (
        <ActivityIndicator size="small" />
      ) : isError ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          Couldn&apos;t load the winner.
        </Text>
      ) : !content ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          No votes were cast in that period.
        </Text>
      ) : (
        <View className="flex-row items-center">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <Text className="text-xs text-neutral-400">IG</Text>
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
              {authorName}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              score {winner.score}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
