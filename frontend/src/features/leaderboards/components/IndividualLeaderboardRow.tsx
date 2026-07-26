import { Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
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
      className={`flex-row items-center border-b border-outline-variant/20 px-6 py-3 ${
        isViewer ? 'bg-primary/10' : ''
      }`}>
      <Text className="w-8 font-title text-sm text-heading">{entry.rank}</Text>
      <View className="mr-3">
        <Avatar username={entry.user.username} size="sm" />
      </View>
      <Text className="flex-1 font-body text-heading">{entry.user.username}</Text>
      <Text className="font-title text-heading">{entry.score}</Text>
    </View>
  );
}
