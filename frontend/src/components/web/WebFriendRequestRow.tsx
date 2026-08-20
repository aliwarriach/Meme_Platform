import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { FriendshipResponse } from '@/services/friends';
import { timeAgo } from '@/utils/timeAgo';

interface WebFriendRequestRowProps {
  request: FriendshipResponse;
  onAccept: (friendshipId: string) => void;
  isAccepting: boolean;
}

/** Themed equivalent of the native `FriendRequestRow` — same data/actions, new Vaporwave/Luminous
 * chrome. */
export function WebFriendRequestRow({ request, onAccept, isAccepting }: WebFriendRequestRowProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <WebAvatar username={request.requester.username} size={40} />
        <View style={styles.identityText}>
          <Text style={[type.title, styles.username]}>{request.requester.username}</Text>
          <Text style={[type.meta, styles.muted]}>Requested {timeAgo(request.created_at)} ago</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Accept friend request from ${request.requester.username}`}
        onPress={() => onAccept(request.id)}
        disabled={isAccepting}
        style={({ hovered }) => [styles.acceptButton, hovered && !isAccepting && styles.acceptButtonHovered, isAccepting && styles.disabled]}>
        {isAccepting ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Text style={[type.title, styles.acceptLabel]}>Accept</Text>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
      minWidth: 0,
    },
    identityText: {
      flex: 1,
      minWidth: 0,
    },
    username: {
      color: colors.foreground,
    },
    muted: {
      color: colors.foregroundMuted,
    },
    acceptButton: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      // indigoSecondary, not indigoPrimary: this pairs with white (`onAccent`) text below, and
      // indigoPrimary is the bright ring/icon-safe variant, not a safe white-text fill (fails AA
      // in dark mode — same reasoning as every other filled element in this system).
      backgroundColor: colors.indigoSecondary,
    },
    acceptButtonHovered: {
      opacity: 0.9,
    },
    acceptLabel: {
      color: colors.onAccent,
    },
    disabled: {
      opacity: 0.5,
    },
  });
