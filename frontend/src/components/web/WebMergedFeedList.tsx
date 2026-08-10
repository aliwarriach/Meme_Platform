import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';

import { WebContainerCard } from '@/components/web/WebContainerCard';
import { WebMemeCard } from '@/components/web/WebMemeCard';
import { FEED_WEB_COLORS, FEED_WEB_SPACING, FEED_WEB_TYPE } from '@/constants/webFeedTheme';
import type { MergedFeedItem } from '@/services/memes';

interface WebMergedFeedListProps {
  items: MergedFeedItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  isRefetching: boolean;
  onRefresh: () => void;
  emptyMessage: string;
}

/**
 * Web-only equivalent of `features/feed/components/MemeFeedList.tsx`'s `MergedFeedList`
 * (native-resolved, untouched) — same pagination/refresh contract, renders the new
 * Web*Card components instead. Deliberately does NOT wire `onViewableItemsChanged` —
 * each card already does its own `IntersectionObserver`-based view tracking via
 * `useRecordViewOnVisible` (see that hook's own comment: FlatList viewability is unreliable
 * on react-native-web), so this list only needs to drive pagination + refresh.
 */
export function WebMergedFeedList({
  items,
  isLoading,
  isError,
  errorMessage,
  hasNextPage,
  isFetchingNextPage,
  onEndReached,
  isRefetching,
  onRefresh,
  emptyMessage,
}: WebMergedFeedListProps) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => (item.kind === 'meme' ? item.meme.id : item.container.id)}
      renderItem={({ item }) =>
        item.kind === 'meme' ? <WebMemeCard meme={item.meme} /> : <WebContainerCard container={item.container} />
      }
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={FEED_WEB_COLORS.foregroundMuted} />}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.footerSpinner} color={FEED_WEB_COLORS.foregroundMuted} /> : null
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={styles.emptySpinner} color={FEED_WEB_COLORS.foregroundMuted} />
        ) : isError ? (
          <Text style={[FEED_WEB_TYPE.body, styles.errorText]}>{errorMessage}</Text>
        ) : (
          <Text style={[FEED_WEB_TYPE.body, styles.emptyText]}>{emptyMessage}</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.lg,
    paddingBottom: 120,
  },
  footerSpinner: {
    marginVertical: FEED_WEB_SPACING.lg,
  },
  emptySpinner: {
    marginVertical: FEED_WEB_SPACING.xxl,
  },
  errorText: {
    marginHorizontal: FEED_WEB_SPACING.lg,
    color: FEED_WEB_COLORS.error,
  },
  emptyText: {
    marginTop: FEED_WEB_SPACING.xxl,
    textAlign: 'center',
    color: FEED_WEB_COLORS.foregroundMuted,
  },
});
