import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text } from 'react-native';

import { MemeCard } from '@/features/feed/components/MemeCard';
import { ContainerCard } from '@/features/instagram-companion/ContainerCard';
import type { MemeResponse, MergedFeedItem } from '@/services/memes';

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
  return (
    <FlatList
      data={memes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MemeCard meme={item} />}
      ListHeaderComponent={ListHeaderComponent}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="my-8" />
        ) : isError ? (
          <Text className="mx-4 text-sm text-red-500">{errorMessage}</Text>
        ) : (
          <Text className="mx-4 mt-8 text-center text-sm text-neutral-400">{emptyMessage}</Text>
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
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator className="my-8" />
        ) : isError ? (
          <Text className="mx-4 text-sm text-red-500">{errorMessage}</Text>
        ) : (
          <Text className="mx-4 mt-8 text-center text-sm text-neutral-400">{emptyMessage}</Text>
        )
      }
    />
  );
}
