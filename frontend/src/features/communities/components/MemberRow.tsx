import { Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import type { MembershipResponse } from '@/services/communities';

interface MemberRowProps {
  membership: MembershipResponse;
}

export function MemberRow({ membership }: MemberRowProps) {
  return (
    <View className="flex-row items-center border-b border-outline-variant/30 py-3">
      <View className="mr-3">
        <Avatar username={membership.user.username} size="sm" />
      </View>
      <Text className="flex-1 font-body text-heading">{membership.user.username}</Text>
      {membership.role === 'owner' ? (
        <View className="rounded-full bg-primary/20 px-3 py-1">
          <Text className="font-label text-xs uppercase tracking-wide text-primary-dim">Owner</Text>
        </View>
      ) : null}
    </View>
  );
}
