import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { FriendResponse } from '@/services/friends';

interface FriendRowProps {
  friend: FriendResponse;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
  onDuel: (friend: FriendResponse) => void;
}

export function FriendRow({ friend, onRemove, isRemoving, onDuel }: FriendRowProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
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
          <MaterialIcons name="sports-kabaddi" size={20} color={c.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${friend.user.username} as a friend`}
          onPress={() => onRemove(friend.friendship_id)}
          disabled={isRemoving}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 disabled:opacity-50">
          {isRemoving ? (
            <ActivityIndicator size="small" color={c.inkMuted} />
          ) : (
            <Text className="font-label text-sm text-error">Remove</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
