import { Image } from 'expo-image';
import { useThemeMode } from '@/constants/ThemeMode';
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { TemplateResponse } from '@/services/templates';

interface TemplateGridProps {
  items: TemplateResponse[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onEndReached: () => void;
  onSelect: (template: TemplateResponse) => void;
  emptyMessage: string;
}

export function TemplateGrid({
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onEndReached,
  onSelect,
  emptyMessage,
}: TemplateGridProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  return (
    <FlatList
      data={items}
      style={{ flex: 1 }}
      keyExtractor={(item) => item.id}
      numColumns={3}
      contentContainerStyle={{ padding: 8 }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use template ${item.name}`}
          onPress={() => onSelect(item)}
          className="m-1 aspect-square flex-1 overflow-hidden rounded-card border border-outline-variant/30">
          <Image
            source={{ uri: item.image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </Pressable>
      )}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" color={c.inkMuted} /> : null}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="mt-8" color={c.inkMuted} />
        ) : (
          <Text className="mt-8 text-center font-body text-sm text-ink-muted">{emptyMessage}</Text>
        )
      }
    />
  );
}
