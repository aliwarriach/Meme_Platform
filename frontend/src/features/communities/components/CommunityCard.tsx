import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useThemeMode } from '@/constants/ThemeMode';
import { Pressable, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { CommunityResponse } from '@/services/communities';
import type { RootState } from '@/store/store';

interface CommunityCardProps {
  community: CommunityResponse;
  onPress: () => void;
}

// `active` isn't in here — it's resolved to "Owner"/"Member" below since a card viewer who
// owns the community was previously always shown the generic "Member" label, indistinguishable
// from any other member.
const STATUS_LABEL: Record<'pending' | 'invited', string> = {
  pending: 'Requested',
  invited: 'Pending',
};

export function CommunityCard({ community, onPress }: CommunityCardProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isOwner = !!currentUser && community.owner.id === currentUser.id;

  const statusLabel =
    community.viewer_membership_status === 'active'
      ? isOwner
        ? 'Owner'
        : 'Member'
      : community.viewer_membership_status
        ? STATUS_LABEL[community.viewer_membership_status]
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        community.has_active_challenge
          ? `Open ${community.name}, active challenge`
          : `Open ${community.name}`
      }
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-card border border-outline-variant/30 bg-surface p-3">
      {community.icon_url ? (
        <Image
          source={{ uri: community.icon_url }}
          style={{ width: 48, height: 48, borderRadius: 16 }}
          contentFit="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-container">
          <Text className="font-title text-lg text-white">
            {community.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      <View className="ml-3 flex-1">
        <Text className="font-title text-base text-heading" numberOfLines={1}>
          {community.name}
        </Text>
        <Text className="mt-0.5 font-body text-xs text-ink-muted">
          {community.member_count} member{community.member_count === 1 ? '' : 's'} ·{' '}
          {community.privacy === 'open' ? 'Open' : 'Invite only'}
        </Text>
        {community.has_active_challenge ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-tertiary px-2 py-0.5">
            <MaterialIcons name="bolt" size={12} color={c.white} />
            <Text className="font-label text-[10px] uppercase text-white">Active Challenge</Text>
          </View>
        ) : null}
      </View>

      {statusLabel ? (
        <View className="rounded-full bg-primary/20 px-3 py-1">
          <Text className="font-label text-xs text-primary-dim">{statusLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
