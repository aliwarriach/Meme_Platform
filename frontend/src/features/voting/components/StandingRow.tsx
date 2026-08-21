import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { StandingContent, StandingEntryResponse } from '@/services/competitions';

interface StandingRowProps {
  entry: StandingEntryResponse;
  onPress: (content: StandingContent) => void;
}

export function StandingRow({ entry, onPress }: StandingRowProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const { content } = entry;
  const isContainer = content.kind === 'container';
  const imageUrl = isContainer ? content.container.thumbnail_url : content.meme.image_url;
  const authorName = isContainer ? content.container.submitter.username : content.meme.author.username;
  const caption = isContainer ? content.container.title : content.meme.caption;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open meme by ${authorName}`}
      onPress={() => onPress(content)}
      className="flex-row items-center border-b border-outline-variant/20 px-4 py-3">
      <Text className="w-8 font-title text-sm text-heading">{entry.rank}</Text>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-surface-high">
          <MaterialIcons name="camera-alt" size={18} color={c.inkMuted} />
        </View>
      )}
      <View className="mx-3 flex-1">
        <Text className="font-title text-heading" numberOfLines={1}>
          {authorName}
        </Text>
        {caption ? (
          <Text className="font-body text-xs text-ink-muted" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <Text className="font-title text-sm text-primary-dim">{entry.score}</Text>
    </Pressable>
  );
}
