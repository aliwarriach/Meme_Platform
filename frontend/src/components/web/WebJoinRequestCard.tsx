import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import WebCommunityAvatar from '@/components/web/WebCommunityAvatar';
import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, type WebPressableState } from '@/constants/webCommunityTheme';
import type { MembershipResponse } from '@/services/communities';

interface WebJoinRequestCardProps {
  request: MembershipResponse;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

/** Owner-only pending-join-request row for the Members tab — theme-aware equivalent of the
 * native `JoinRequestRow`, kept as a row (not a block card) since it carries two full-width
 * actions and reads better scanned top-to-bottom in a moderation list. */
export function WebJoinRequestCard({ request, onApprove, onReject, isPending }: WebJoinRequestCardProps) {
  const { colors } = useCommunityWebTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <WebCommunityAvatar label={request.user.username} imageUrl={request.user.avatar_url} size={36} />
      <Text style={[COMMUNITY_WEB_TYPE.title, styles.name, { color: colors.cardForeground }]}>
        {request.user.username}
      </Text>
      {isPending ? (
        <ActivityIndicator color={colors.foregroundMuted} />
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Approve ${request.user.username}`}
            onPress={onApprove}
            style={({ hovered, focused }: WebPressableState) => [
              styles.actionButton,
              { backgroundColor: colors.accent },
              hovered && { opacity: 0.85 },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.onAccent, fontSize: 11 }]}>Approve</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decline ${request.user.username}`}
            onPress={onReject}
            style={({ hovered, focused }: WebPressableState) => [
              styles.actionButton,
              styles.declineButton,
              { borderColor: colors.border },
              hovered && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.foreground, fontSize: 11 }]}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    padding: COMMUNITY_WEB_SPACING.md,
    marginBottom: COMMUNITY_WEB_SPACING.sm,
  },
  name: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  actionButton: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.md,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
});
