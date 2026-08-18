import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebCommunityAvatar from '@/components/web/WebCommunityAvatar';
import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, type WebPressableState } from '@/constants/webCommunityTheme';
import type { CommunityResponse } from '@/services/communities';

interface WebCommunityCardProps {
  community: CommunityResponse;
  onPress: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Member',
  pending: 'Pending',
};

/** Directory "block" card for the Discover/My Communities grid — the visual anchor of this
 * page's "Vibrant & Block-based" style (bold block layout, geometric shapes, high color
 * contrast), replacing the native single-column `CommunityCard` row. */
export function WebCommunityCard({ community, onPress }: WebCommunityCardProps) {
  const { colors } = useCommunityWebTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        community.has_active_challenge ? `Open ${community.name}, active challenge` : `Open ${community.name}`
      }
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        hovered && { borderColor: colors.primary },
        focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
      ]}>
      <View style={styles.headerRow}>
        <WebCommunityAvatar label={community.name} imageUrl={community.icon_url} size={48} square />
        {community.viewer_membership_status ? (
          <View style={[styles.statusPill, { backgroundColor: colors.elevated }]}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.primary, fontSize: 10 }]}>
              {STATUS_LABEL[community.viewer_membership_status]}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[COMMUNITY_WEB_TYPE.cardTitle, styles.name, { color: colors.cardForeground }]} numberOfLines={1}>
        {community.name}
      </Text>
      {community.description ? (
        <Text style={[COMMUNITY_WEB_TYPE.meta, styles.description, { color: colors.foregroundMuted }]} numberOfLines={2}>
          {community.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
          {community.member_count} member{community.member_count === 1 ? '' : 's'} ·{' '}
          {community.privacy === 'open' ? 'Open' : 'Invite only'}
        </Text>
        {community.has_active_challenge ? (
          <View style={[styles.challengeBadge, { backgroundColor: colors.accent }]}>
            <MaterialIcons name="bolt" size={12} color={colors.onAccent} />
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.onAccent, fontSize: 9 }]}>Active</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    padding: COMMUNITY_WEB_SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: COMMUNITY_WEB_SPACING.md,
  },
  statusPill: {
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 3,
  },
  name: {
    marginBottom: 2,
  },
  description: {
    marginBottom: COMMUNITY_WEB_SPACING.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 3,
  },
});
