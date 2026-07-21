import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { CommunityResponse } from '@/services/communities';

interface CommunityCardProps {
  community: CommunityResponse;
  onPress: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Member',
  pending: 'Request pending',
};

export function CommunityCard({ community, onPress }: CommunityCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${community.name}`}
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      {community.icon_url ? (
        <Image
          source={{ uri: community.icon_url }}
          style={{ width: 48, height: 48, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-orange-500">
          <Text className="text-lg font-extrabold text-white">
            {community.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      <View className="ml-3 flex-1">
        <Text className="font-semibold text-neutral-900 dark:text-white">{community.name}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {community.member_count} member{community.member_count === 1 ? '' : 's'} ·{' '}
          {community.privacy === 'open' ? 'Open' : 'Invite only'}
        </Text>
      </View>

      {community.viewer_membership_status ? (
        <View className="rounded-full bg-orange-100 px-2.5 py-1 dark:bg-orange-500/20">
          <Text className="text-xs font-semibold text-orange-600 dark:text-orange-400">
            {STATUS_LABEL[community.viewer_membership_status]}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
