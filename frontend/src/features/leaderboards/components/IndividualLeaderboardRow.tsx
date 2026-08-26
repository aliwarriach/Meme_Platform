import { Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { RankBadge, rankTintClassName } from '@/components/RankBadge';
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
      className={`flex-row items-center border-b border-outline-variant/20 px-6 py-3 ${rankTintClassName(entry.rank)} ${
        isViewer ? 'border-l-4 border-l-primary' : ''
      }`}>
      <View className="mr-2">
        <RankBadge rank={entry.rank} />
      </View>
      <View className="mr-3">
        <Avatar username={entry.user.username} size="sm" />
      </View>
      <Text className="flex-1 font-body text-heading">{entry.user.username}</Text>
      {isViewer ? (
        <View className="mr-2 rounded-full bg-primary px-2 py-0.5">
          <Text className="font-label text-[10px] text-white">You</Text>
        </View>
      ) : null}
      <Text className="font-title text-heading">{entry.score}</Text>
    </View>
  );
}
