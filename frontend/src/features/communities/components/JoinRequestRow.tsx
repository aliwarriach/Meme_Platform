import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { MembershipResponse } from '@/services/communities';

interface JoinRequestRowProps {
  request: MembershipResponse;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

export function JoinRequestRow({ request, onApprove, onReject, isPending }: JoinRequestRowProps) {
  return (
    <View className="flex-row items-center border-b border-neutral-100 py-3 dark:border-neutral-800">
      <Text className="flex-1 text-neutral-900 dark:text-white">{request.user.username}</Text>
      {isPending ? (
        <ActivityIndicator size="small" />
      ) : (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Approve ${request.user.username}`}
            onPress={onApprove}
            className="mr-2 min-h-[36px] items-center justify-center rounded-lg bg-orange-500 px-3">
            <Text className="text-xs font-bold text-white">Approve</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reject ${request.user.username}`}
            onPress={onReject}
            className="min-h-[36px] items-center justify-center rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
            <Text className="text-xs font-bold text-neutral-900 dark:text-white">Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
