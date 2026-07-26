import { MaterialIcons } from '@expo/vector-icons';
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
    <View className="mx-4 mb-3 rounded-card border border-primary/30 bg-primary/10 p-4">
      <View className="mb-2 flex-row items-center gap-1.5">
        <MaterialIcons name="emoji-events" size={16} color="#ffb1c4" />
        <Text className="font-label text-xs uppercase text-primary-dim">{label}</Text>
        {!isLoading && !isError && content ? (
          <View className="ml-1 rounded-full bg-primary px-2 py-0.5">
            <Text className="font-label text-[10px] text-white">#1</Text>
          </View>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color="#e3bdc5" />
      ) : isError ? (
        <Text className="font-body text-sm text-ink-muted">Couldn&apos;t load the winner.</Text>
      ) : !content ? (
        <Text className="font-body text-sm text-ink-muted">No votes were cast in that period.</Text>
      ) : (
        <View className="flex-row items-center">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: 48, height: 48, borderRadius: 16 }} contentFit="cover" />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-high">
              <MaterialIcons name="camera-alt" size={16} color="#e3bdc5" />
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="font-title text-heading" numberOfLines={1}>
              {authorName}
            </Text>
            <Text className="font-body text-xs text-ink-muted">score {winner.score}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
