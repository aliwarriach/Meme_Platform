import { StyleSheet, Text, View } from 'react-native';

import WebCommunityAvatar from '@/components/web/WebCommunityAvatar';
import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE } from '@/constants/webCommunityTheme';
import type { MembershipResponse } from '@/services/communities';

interface WebMemberCardProps {
  membership: MembershipResponse;
}

/** Member "block" card for the detail screen's Members grid — same block-card language as
 * `WebCommunityCard`, replacing the native single-column `MemberRow`. */
export function WebMemberCard({ membership }: WebMemberCardProps) {
  const { colors } = useCommunityWebTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessible
      accessibilityLabel={membership.role === 'owner' ? `${membership.user.username}, owner` : membership.user.username}>
      <WebCommunityAvatar label={membership.user.username} imageUrl={membership.user.avatar_url} size={40} />
      <Text style={[COMMUNITY_WEB_TYPE.title, styles.name, { color: colors.cardForeground }]} numberOfLines={1}>
        {membership.user.username}
      </Text>
      {membership.role === 'owner' ? (
        <View style={[styles.badge, { backgroundColor: colors.elevated }]}>
          <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.primary, fontSize: 10 }]}>Owner</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    padding: COMMUNITY_WEB_SPACING.md,
    gap: COMMUNITY_WEB_SPACING.xs,
  },
  name: {
    textAlign: 'center',
  },
  badge: {
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 2,
  },
});
