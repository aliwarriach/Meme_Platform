import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text } from 'react-native';

import { MemeCard } from '@/features/feed/components/MemeCard';
import type { MemeResponse } from '@/services/memes';

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
