import { Text, View } from 'react-native';

import type { IndividualLeaderboardEntryResponse } from '@/services/leaderboards';

interface IndividualLeaderboardRowProps {
  entry: IndividualLeaderboardEntryResponse;
  isViewer: boolean;
}

export function IndividualLeaderboardRow({ entry, isViewer }: IndividualLeaderboardRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`Rank ${entry.rank}, ${entry.user.username}${isViewer ? ', you' : ''}, ${entry.score} points`}
      className={`flex-row items-center border-b border-neutral-100 px-6 py-3 dark:border-neutral-800 ${
        isViewer ? 'bg-orange-50 dark:bg-orange-500/10' : ''
      }`}>
      <Text className="w-8 text-sm font-bold text-neutral-400">{entry.rank}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-orange-500">
        <Text className="text-xs font-bold text-white">
          {entry.user.username.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text className="flex-1 text-neutral-900 dark:text-white">{entry.user.username}</Text>
      <Text className="font-bold text-neutral-900 dark:text-white">{entry.score}</Text>
    </View>
  );
}
