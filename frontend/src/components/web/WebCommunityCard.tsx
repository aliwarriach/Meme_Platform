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

        <View style={styles.headerText}>
          <Text
            style={[COMMUNITY_WEB_TYPE.cardTitle, styles.name, { color: colors.cardForeground }]}
            numberOfLines={1}>
            {community.name}
          </Text>

          {community.description ? (
            <Text
              style={[COMMUNITY_WEB_TYPE.meta, styles.description, { color: colors.foregroundMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {community.description}
            </Text>
          ) : null}

          <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
            {community.member_count} member{community.member_count === 1 ? '' : 's'} ·{' '}
            {community.privacy === 'open' ? 'Open' : 'Invite only'}
          </Text>
        </View>

        {community.viewer_membership_status ? (
          <View style={[styles.statusPill, { backgroundColor: colors.elevated }]}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.primary, fontSize: 10 }]}>
              {STATUS_LABEL[community.viewer_membership_status]}
            </Text>
          </View>
        ) : null}
      </View>

      {community.has_active_challenge ? (
        <View style={styles.footerRow}>
          <View style={[styles.challengeBadge, { backgroundColor: colors.accent }]}>
            <MaterialIcons name="bolt" size={12} color={colors.onAccent} />
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.onAccent, fontSize: 9 }]}>Active</Text>
          </View>
        </View>
      ) : null}
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
    // A shade under `xl` (24) — a small deliberate trim of the card's own outer padding, kept
    // separate from the internal gaps between name/description/meta (those stay on the spacing
    // scale untouched).
    padding: COMMUNITY_WEB_SPACING.xl - 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: COMMUNITY_WEB_SPACING.xs,
  },
  statusPill: {
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  name: {
    flexShrink: 1,
  },
  description: {
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    paddingTop: COMMUNITY_WEB_SPACING.md,
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
