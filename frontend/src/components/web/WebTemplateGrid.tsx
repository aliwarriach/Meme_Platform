import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { TemplateResponse } from '@/services/templates';

interface WebTemplateGridProps {
  items: TemplateResponse[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onEndReached: () => void;
  onSelect: (template: TemplateResponse) => void;
  emptyMessage: string;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/** Themed replacement for `features/creator/components/TemplateGrid.tsx` — paginated 3-column
 * thumbnail grid, unchanged data contract (both `useTemplates`/`useCommunityTemplates` callers
 * pass the same paginated shape straight through). */
export function WebTemplateGrid({
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onEndReached,
  onSelect,
  emptyMessage,
}: WebTemplateGridProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <FlatList
      data={items}
      style={styles.list}
      keyExtractor={(item) => item.id}
      numColumns={3}
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use template ${item.name}`}
          onPress={() => onSelect(item)}
          style={({ hovered, focused }: WebPressableState) => [
            styles.cell,
            { borderColor: colors.border },
            hovered && { borderColor: colors.borderSolid },
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
        </Pressable>
      )}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} /> : null
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={styles.spinnerTop} color={colors.foregroundMuted} />
        ) : (
          <Text style={[type.body, styles.empty, { color: colors.foregroundMuted }]}>{emptyMessage}</Text>
        )
      }
    />
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    list: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    cell: {
      margin: spacing.xs,
      flex: 1,
      aspectRatio: 1,
      overflow: 'hidden',
      borderRadius: radius.chip,
      borderWidth: 1,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    spinner: {
      marginVertical: spacing.lg,
    },
    spinnerTop: {
      marginTop: spacing.xxl,
    },
    empty: {
      marginTop: spacing.xxl,
      textAlign: 'center',
    },
  });
