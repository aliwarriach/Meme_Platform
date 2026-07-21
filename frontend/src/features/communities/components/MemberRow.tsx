import { Text, View } from 'react-native';

import type { MembershipResponse } from '@/services/communities';

interface MemberRowProps {
  membership: MembershipResponse;
}

export function MemberRow({ membership }: MemberRowProps) {
  return (
    <View className="flex-row items-center border-b border-neutral-100 py-3 dark:border-neutral-800">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-orange-500">
        <Text className="text-xs font-bold text-white">
          {membership.user.username.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text className="flex-1 text-neutral-900 dark:text-white">{membership.user.username}</Text>
      {membership.role === 'owner' ? (
        <Text className="text-xs font-semibold uppercase tracking-wide text-orange-500">
          Owner
        </Text>
      ) : null}
    </View>
  );
}
