import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useThemeMode } from '@/constants/ThemeMode';
import { ChallengeRow } from '@/features/challenges/components/ChallengeRow';
import { CommunityCard } from '@/features/communities/components/CommunityCard';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import type { PublicUserResponse } from '@/services/auth';
import type { ChallengeResponse } from '@/services/challenges';
import type { CommunityResponse } from '@/services/communities';
import type { HashtagSuggestionResponse } from '@/services/hashtags';
import type { MemeResponse } from '@/services/memes';
import type { SearchScope } from '@/services/search';
import { useSearchScope } from '@/services/useSearch';

interface SearchResultsListProps {
  query: string;
  scope: Exclude<SearchScope, 'all'>;
}

function HashtagRow({ item, onPress }: { item: HashtagSuggestionResponse; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open #${item.display_text}`}
      onPress={onPress}
      className="mb-1 min-h-[44px] justify-center rounded-card px-2 py-2">
      <Text className="font-title text-base text-heading">#{item.display_text}</Text>
      {item.challenge_title ? (
        <Text className="font-body text-xs text-ink-muted">Enters: {item.challenge_title}</Text>
      ) : null}
    </Pressable>
  );
}

function PersonRow({ item, onPress }: { item: PublicUserResponse; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.username}'s profile`}
      onPress={onPress}
      className="mb-1 min-h-[44px] flex-row items-center gap-3 rounded-card px-2 py-2">
      <Avatar username={item.username} avatarUrl={item.avatar_url} avatarPreset={item.avatar_preset} size="md" />
      <Text className="font-body text-heading">{item.username}</Text>
    </Pressable>
  );
}

/** Renders one scope's paginated results — the tab body once a tab other than the
 * `scope=all` preview is selected (Roadmap_Search.md S6 step 2). Reuses existing row
 * components (`ChallengeRow`, `CommunityCard`, `MemeFeedList`) rather than building new
 * ones, except Tags/People, which have no existing standalone row to reuse. */
export function SearchResultsList({ query, scope }: SearchResultsListProps) {
  const router = useRouter();
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const resultsQuery = useSearchScope(query, scope, true);

  const items = resultsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const emptyMessage = `No ${scope} match "${query}"`;

  if (scope === 'posts') {
    return (
      <MemeFeedList
        memes={items as MemeResponse[]}
        isLoading={resultsQuery.isLoading}
        isError={resultsQuery.isError}
        errorMessage={resultsQuery.error?.message}
        hasNextPage={resultsQuery.hasNextPage}
        isFetchingNextPage={resultsQuery.isFetchingNextPage}
        onEndReached={() => resultsQuery.fetchNextPage()}
        isRefetching={resultsQuery.isRefetching}
        onRefresh={() => resultsQuery.refetch()}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) =>
        scope === 'tags' ? (item as HashtagSuggestionResponse).slug : ((item as { id: string }).id ?? String(index))
      }
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) resultsQuery.fetchNextPage();
      }}
      ListFooterComponent={
        resultsQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color={c.inkMuted} /> : null
      }
      ListEmptyComponent={
        resultsQuery.isLoading ? (
          <ActivityIndicator className="my-8" color={c.inkMuted} />
        ) : resultsQuery.isError ? (
          <Text className="mt-4 font-body text-sm text-error">{resultsQuery.error?.message}</Text>
        ) : (
          <Text className="mt-8 text-center font-body text-sm text-ink-muted">{emptyMessage}</Text>
        )
      }
      renderItem={({ item }) => {
        if (scope === 'tags') {
          const tag = item as HashtagSuggestionResponse;
          return (
            <HashtagRow
              item={tag}
              onPress={() => router.push({ pathname: '/tag/[slug]', params: { slug: tag.slug } })}
            />
          );
        }
        if (scope === 'people') {
          const person = item as PublicUserResponse;
          return (
            <PersonRow
              item={person}
              onPress={() => router.push({ pathname: '/users/[id]', params: { id: person.id } })}
            />
          );
        }
        if (scope === 'communities') {
          const community = item as CommunityResponse;
          return (
            <CommunityCard
              community={community}
              onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })}
            />
          );
        }
        const challenge = item as ChallengeResponse;
        return (
          <ChallengeRow
            challenge={challenge}
            onPress={() => router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } })}
          />
        );
      }}
    />
  );
}
