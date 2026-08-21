import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { MembershipResponse } from '@/services/communities';

interface JoinRequestRowProps {
  request: MembershipResponse;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

export function JoinRequestRow({ request, onApprove, onReject, isPending }: JoinRequestRowProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  return (
    <View className="flex-row items-center border-b border-outline-variant/30 py-3">
      <View className="mr-3">
        <Avatar username={request.user.username} size="sm" />
      </View>
      <Text className="flex-1 font-body text-heading">{request.user.username}</Text>
      {isPending ? (
        <ActivityIndicator size="small" color={c.inkMuted} />
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Approve ${request.user.username}`}
            onPress={onApprove}
            className="min-h-[36px] items-center justify-center rounded-full bg-primary-container px-3">
            <Text className="font-title text-xs text-white">Approve</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reject ${request.user.username}`}
            onPress={onReject}
            className="min-h-[36px] items-center justify-center rounded-full border border-outline px-3">
            <Text className="font-title text-xs text-heading">Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
