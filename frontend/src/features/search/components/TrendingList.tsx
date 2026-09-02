import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useThemeMode } from '@/constants/ThemeMode';
import type { TrendingHashtagResponse } from '@/services/trending';
import { useTrendingHashtags } from '@/services/useSearch';

const REASON_BADGE: Record<TrendingHashtagResponse['reason'], string | null> = {
  trending: null,
  live_challenge: 'Live challenge',
  popular: 'Popular',
};

/** Empty-query state — a tag never mislabels a cold-start backfill item as "trending"
 * (Roadmap_Search.md S2/S6): `reason !== 'trending'` gets an honest badge instead. */
export function TrendingList() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const trendingQuery = useTrendingHashtags();

  if (trendingQuery.isLoading) {
    return <ActivityIndicator className="my-8" color={c.inkMuted} />;
  }
  if (trendingQuery.isError) {
    return (
      <Text className="mx-4 mt-4 font-body text-sm text-error">{trendingQuery.error.message}</Text>
    );
  }

  const items = trendingQuery.data?.items ?? [];
  if (items.length === 0) {
    return (
      <Text className="mx-4 mt-8 text-center font-body text-sm text-ink-muted">
        Nothing trending yet — be the first to post with a tag.
      </Text>
    );
  }

  return (
    <View className="px-4 pt-2">
      <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
        Trending
      </Text>
      {items.map((item) => {
        const badge = REASON_BADGE[item.reason];
        return (
          <Pressable
            key={item.slug}
            accessibilityRole="button"
            accessibilityLabel={`Open #${item.display_text}`}
            onPress={() => router.push({ pathname: '/tag/[slug]', params: { slug: item.slug } })}
            className="mb-1 min-h-[44px] flex-row items-center justify-between rounded-card px-2 py-2">
            <View className="flex-1">
              <Text className="font-title text-base text-heading" numberOfLines={1}>
                #{item.display_text}
              </Text>
              <Text className="font-body text-xs text-ink-muted">
                {item.author_count_24h > 0
                  ? `${item.meme_count_24h} post${item.meme_count_24h === 1 ? '' : 's'} today`
                  : item.challenge
                    ? item.challenge.title
                    : 'Popular tag'}
              </Text>
            </View>
            {badge ? (
              <View className="rounded-full bg-surface-high px-2 py-1">
                <Text className="font-label text-[10px] uppercase text-ink-muted">{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
