import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { FriendshipResponse } from '@/services/friends';

interface FriendRequestRowProps {
  request: FriendshipResponse;
  onAccept: (friendshipId: string) => void;
  isAccepting: boolean;
}

export function FriendRequestRow({ request, onAccept, isAccepting }: FriendRequestRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
      <Text className="text-base font-semibold text-neutral-900 dark:text-white">
        {request.requester.username}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Accept friend request from ${request.requester.username}`}
        onPress={() => onAccept(request.id)}
        disabled={isAccepting}
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-orange-500 px-4 disabled:opacity-50">
        {isAccepting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="text-sm font-bold text-white">Accept</Text>
        )}
      </Pressable>
    </View>
  );
}
