import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import type { FriendResponse } from '@/services/friends';

interface FriendRowProps {
  friend: FriendResponse;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
  onDuel: (friend: FriendResponse) => void;
}

export function FriendRow({ friend, onRemove, isRemoving, onDuel }: FriendRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-outline-variant/20 px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar username={friend.user.username} size="md" />
        <Text className="font-title text-heading">{friend.user.username}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Challenge ${friend.user.username} to a duel`}
          onPress={() => onDuel(friend)}
          className="h-11 w-11 items-center justify-center">
          <MaterialIcons name="sports-kabaddi" size={20} color="#e3bdc5" />
        </Pressable>
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
    </View>
  );
}
