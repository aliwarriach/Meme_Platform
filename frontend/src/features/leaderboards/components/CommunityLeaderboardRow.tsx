import { Text, View } from 'react-native';

import { RankBadge, rankTintClassName } from '@/components/RankBadge';
import type { CommunityLeaderboardEntryResponse } from '@/services/leaderboards';

interface CommunityLeaderboardRowProps {
  entry: CommunityLeaderboardEntryResponse;
}

export function CommunityLeaderboardRow({ entry }: CommunityLeaderboardRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`Rank ${entry.rank}, ${entry.community_name}, ${entry.score} points`}
      className={`flex-row items-center border-b border-outline-variant/20 px-6 py-3 ${rankTintClassName(entry.rank)}`}>
      <View className="mr-2">
        <RankBadge rank={entry.rank} />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mr-3 h-9 w-9 items-center justify-center rounded-2xl bg-primary-container">
        <Text className="font-title text-xs text-white">
          {entry.community_name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text className="flex-1 font-body text-heading">{entry.community_name}</Text>
      <Text className="font-title text-heading">{entry.score}</Text>
    </View>
  );
}
