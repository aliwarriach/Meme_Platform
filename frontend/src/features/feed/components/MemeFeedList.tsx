import type { ReactElement } from 'react';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, Text, type ViewToken } from 'react-native';

import { MemeCard } from '@/features/feed/components/MemeCard';
import { ContainerCard } from '@/features/instagram-companion/ContainerCard';
import type { MemeResponse, MergedFeedItem } from '@/services/memes';
import { useRecordContainerViewMutation } from '@/services/useInstagram';
import { useRecordMemeViewMutation } from '@/services/useMemes';

// Two view-tracking paths, one per platform, deliberately not shared:
//  - web: each card observes its own visibility via IntersectionObserver
//    (features/feed/components/MemeCard.tsx / instagram-companion/ContainerCard.tsx +
//    utils/useRecordViewOnVisible) — FlatList's onViewableItemsChanged/viewabilityConfig
//    relies on VirtualizedList's native scroll-metrics tracking, which is unreliable on
//    react-native-web (callbacks often never fire in the browser regardless of scroll
//    position or card size).
//  - native (iOS/Android): VirtualizedList's viewability tracking is the real, correct
//    mechanism there, so this list still drives it directly (below), rather than trying to
//    reuse the web-only per-card observer. Guarded to native-only so web doesn't double-fire.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50, minimumViewTime: 1000 };

interface MemeFeedListProps {
  memes: MemeResponse[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  isRefetching: boolean;
  onRefresh: () => void;
  emptyMessage: string;
  ListHeaderComponent?: ReactElement | null;
}

export function MemeFeedList({
  memes,
  isLoading,
  isError,
  errorMessage,
  hasNextPage,
  isFetchingNextPage,
  onEndReached,
  isRefetching,
  onRefresh,
  emptyMessage,
  ListHeaderComponent,
}: MemeFeedListProps) {
  const recordMemeView = useRecordMemeViewMutation();
  const seenMemeIds = useRef(new Set<string>());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const viewable of viewableItems) {
        const meme = viewable.item as MemeResponse;
        if (!seenMemeIds.current.has(meme.id)) {
          seenMemeIds.current.add(meme.id);
          recordMemeView.mutate(meme.id);
        }
      }
    },
    [recordMemeView]
  );

  return (
    <FlatList
      data={memes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MemeCard meme={item} />}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={{ paddingBottom: 100 }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      {...(Platform.OS !== 'web'
        ? { onViewableItemsChanged, viewabilityConfig: VIEWABILITY_CONFIG }
        : {})}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" color="#e3bdc5" /> : null}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="my-8" color="#e3bdc5" />
        ) : isError ? (
          <Text className="mx-4 font-body text-sm text-error">{errorMessage}</Text>
        ) : (
          <Text className="mx-4 mt-8 text-center font-body text-sm text-ink-muted">{emptyMessage}</Text>
        )
      }
    />
  );
}

interface MergedFeedListProps {
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
  ListHeaderComponent?: ReactElement | null;
}

// The public feed merges native memes and MemeContainers (Instagram Companion Mode) into
// one scroll — see backend services/instagram.py::get_merged_feed. Community feeds stay
// memes-only and keep using the plain MemeFeedList above.
export function MergedFeedList({
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
  ListHeaderComponent,
}: MergedFeedListProps) {
  const recordMemeView = useRecordMemeViewMutation();
  const recordContainerView = useRecordContainerViewMutation();
  const seenIds = useRef(new Set<string>());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const viewable of viewableItems) {
        const item = viewable.item as MergedFeedItem;
        const id = item.kind === 'meme' ? item.meme.id : item.container.id;
        if (seenIds.current.has(id)) continue;
        seenIds.current.add(id);
        if (item.kind === 'meme') recordMemeView.mutate(id);
        else recordContainerView.mutate(id);
      }
    },
    [recordMemeView, recordContainerView]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => (item.kind === 'meme' ? item.meme.id : item.container.id)}
      renderItem={({ item }) =>
        item.kind === 'meme' ? (
          <MemeCard meme={item.meme} />
        ) : (
          <ContainerCard container={item.container} />
        )
      }
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={{ paddingBottom: 100 }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      {...(Platform.OS !== 'web'
        ? { onViewableItemsChanged, viewabilityConfig: VIEWABILITY_CONFIG }
        : {})}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" color="#e3bdc5" /> : null}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="my-8" color="#e3bdc5" />
        ) : isError ? (
          <Text className="mx-4 font-body text-sm text-error">{errorMessage}</Text>
        ) : (
          <Text className="mx-4 mt-8 text-center font-body text-sm text-ink-muted">{emptyMessage}</Text>
        )
      }
    />
  );
}
