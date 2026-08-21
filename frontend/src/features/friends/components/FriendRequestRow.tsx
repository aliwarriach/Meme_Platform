import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { FriendshipResponse } from '@/services/friends';
import { timeAgo } from '@/utils/timeAgo';

interface FriendRequestRowProps {
  request: FriendshipResponse;
  onAccept: (friendshipId: string) => void;
  isAccepting: boolean;
}

export function FriendRequestRow({ request, onAccept, isAccepting }: FriendRequestRowProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  return (
    <View className="flex-row items-center justify-between border-b border-outline-variant/20 px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar username={request.requester.username} size="md" />
        <View>
          <Text className="font-title text-heading">{request.requester.username}</Text>
          <Text className="font-body text-xs text-ink-muted">Requested {timeAgo(request.created_at)} ago</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Accept friend request from ${request.requester.username}`}
        onPress={() => onAccept(request.id)}
        disabled={isAccepting}
        className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary-container px-4 disabled:opacity-50">
        {isAccepting ? (
          <ActivityIndicator size="small" color={c.white} />
        ) : (
          <Text className="font-title text-sm text-white">Accept</Text>
        )}
      </Pressable>
    </View>
  );
}
