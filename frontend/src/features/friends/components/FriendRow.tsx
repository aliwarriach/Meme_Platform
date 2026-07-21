import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { FriendResponse } from '@/services/friends';

interface FriendRowProps {
  friend: FriendResponse;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
}

export function FriendRow({ friend, onRemove, isRemoving }: FriendRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
      <View className="flex-row items-center">
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-orange-500">
          <Text className="font-bold text-white">{friend.user.username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">
          {friend.user.username}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${friend.user.username} as a friend`}
        onPress={() => onRemove(friend.friendship_id)}
        disabled={isRemoving}
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 disabled:opacity-50">
        {isRemoving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className="text-sm font-semibold text-red-500">Remove</Text>
        )}
      </Pressable>
    </View>
  );
}
