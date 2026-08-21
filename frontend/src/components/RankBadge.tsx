import { useThemeMode } from '@/constants/ThemeMode';
import { Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

const TIER_CLASSES: Record<1 | 2 | 3, string> = {
  1: 'bg-rank-gold',
  2: 'bg-rank-silver',
  3: 'bg-rank-bronze',
};

/** Rank number, medal-filled for the top 3 (gold/silver/bronze, dark-ink text — the
 * accessibility-safe fill pairing `webFeedThemeVapor.ts` establishes for these tokens), plain
 * `heading`-colored text otherwise. Shared by `IndividualLeaderboardRow`/`CommunityLeaderboardRow`
 * so both leaderboards carry the same medal treatment. */
export function RankBadge({ rank }: { rank: number }) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  if (rank === 1 || rank === 2 || rank === 3) {
    return (
      <View className={`h-8 w-8 items-center justify-center rounded-full ${TIER_CLASSES[rank]}`}>
        <Text className="font-title text-sm" style={{ color: c.onAccentInk }}>
          {rank}
        </Text>
      </View>
    );
  }

  return (
    <View className="h-8 w-8 items-center justify-center">
      <Text className="font-title text-sm text-heading">{rank}</Text>
    </View>
  );
}

/** Row background tint for the top 3 ranks — a subtle medal-tinted wash instead of the generic
 * `bg-primary/10` "you" highlight, so a medal row reads as "this rank's own color." Composes with
 * (does not replace) the viewer highlight, which a leaderboard row applies separately. */
export function rankTintClassName(rank: number): string {
  if (rank === 1) return 'bg-rank-gold-tint';
  if (rank === 2) return 'bg-rank-silver-tint';
  if (rank === 3) return 'bg-rank-bronze-tint';
  return '';
}
