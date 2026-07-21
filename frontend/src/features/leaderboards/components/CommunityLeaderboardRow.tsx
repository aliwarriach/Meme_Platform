import { Text, View } from 'react-native';

import type { CommunityLeaderboardEntryResponse } from '@/services/leaderboards';

interface CommunityLeaderboardRowProps {
  entry: CommunityLeaderboardEntryResponse;
}

export function CommunityLeaderboardRow({ entry }: CommunityLeaderboardRowProps) {
  return (
    <View className="flex-row items-center border-b border-neutral-100 px-6 py-3 dark:border-neutral-800">
      <Text className="w-8 text-sm font-bold text-neutral-400">{entry.rank}</Text>
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-2xl bg-orange-500">
        <Text className="text-xs font-bold text-white">
          {entry.community_name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text className="flex-1 text-neutral-900 dark:text-white">{entry.community_name}</Text>
      <Text className="font-bold text-neutral-900 dark:text-white">{entry.score}</Text>
    </View>
  );
}
