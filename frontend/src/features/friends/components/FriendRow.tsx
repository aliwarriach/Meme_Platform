import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import type { FriendResponse } from '@/services/friends';

interface FriendRowProps {
  friend: FriendResponse;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
}

export function FriendRow({ friend, onRemove, isRemoving }: FriendRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-outline-variant/20 px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar username={friend.user.username} size="md" />
        <Text className="font-title text-heading">{friend.user.username}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${friend.user.username} as a friend`}
        onPress={() => onRemove(friend.friendship_id)}
        disabled={isRemoving}
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 disabled:opacity-50">
        {isRemoving ? (
          <ActivityIndicator size="small" color="#e3bdc5" />
        ) : (
          <Text className="font-label text-sm text-error">Remove</Text>
        )}
      </Pressable>
    </View>
  );
}
