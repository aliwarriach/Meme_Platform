import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { StandingContent, WinnerResponse } from '@/services/competitions';

interface WinnerBannerProps {
  winner: WinnerResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  label: string;
  onPress: (content: StandingContent) => void;
}

export function WinnerBanner({ winner, isLoading, isError, label, onPress }: WinnerBannerProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const content = winner?.content;
  const isDeletedMeme = content?.kind === 'meme' && content.is_deleted;
  const imageUrl =
    content?.kind === 'container' ? content.container.thumbnail_url : content?.meme?.image_url;
  const authorName =
    content?.kind === 'container' ? content.container.submitter.username : content?.meme?.author.username;

  const header = (
    <View className="mb-2 flex-row items-center gap-1.5">
      <MaterialIcons name="emoji-events" size={16} color={c.primaryDim} />
      <Text className="font-label text-xs uppercase text-primary-dim">{label}</Text>
      {!isLoading && !isError && content ? (
        <View className="ml-1 rounded-full bg-primary-container px-2 py-0.5">
          <Text className="font-label text-[10px] text-white">#1</Text>
        </View>
      ) : null}
    </View>
  );

  // Whole card is one press target (header + entry), not just the inner row — a partial-card
  // press target reads as broken on a touch device just as much as it did as a partial hover
  // on web. A deleted-meme winner (see StandingContent's comment) renders the same shell as
  // plain View, not Pressable — there's nothing left to open, and the win itself still stands.
  if (!isLoading && !isError && content) {
    const body = (
      <>
        {header}
        <View className="flex-row items-center">
          {isDeletedMeme ? (
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-high">
              <MaterialIcons name="delete-outline" size={18} color={c.inkMuted} />
            </View>
          ) : imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: 48, height: 48, borderRadius: 16 }} contentFit="cover" />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-high">
              <MaterialIcons name="camera-alt" size={16} color={c.inkMuted} />
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="font-title text-heading" numberOfLines={1}>
              {isDeletedMeme ? 'Deleted Post' : authorName}
            </Text>
            <Text className="font-body text-xs text-ink-muted">score {winner.score}</Text>
          </View>
        </View>
      </>
    );

    if (isDeletedMeme) {
      return (
        <View className="mx-4 mb-3 rounded-card border border-primary/30 bg-primary/10 p-4 opacity-70">
          {body}
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open meme by ${authorName}`}
        onPress={() => onPress(content)}
        className="mx-4 mb-3 rounded-card border border-primary/30 bg-primary/10 p-4 active:bg-primary/20">
        {body}
      </Pressable>
    );
  }

  return (
    <View className="mx-4 mb-3 rounded-card border border-primary/30 bg-primary/10 p-4">
      {header}
      {isLoading ? (
        <ActivityIndicator size="small" color={c.inkMuted} />
      ) : isError ? (
        <Text className="font-body text-sm text-ink-muted">Couldn&apos;t load the winner.</Text>
      ) : (
        <Text className="font-body text-sm text-ink-muted">No votes were cast in that period.</Text>
      )}
    </View>
  );
}
