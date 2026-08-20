import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { FriendResponse } from '@/services/friends';

interface WebFriendRowProps {
  friend: FriendResponse;
  onRemove: (friendshipId: string) => void;
  isRemoving: boolean;
  onDuel: (friend: FriendResponse) => void;
}

/** Themed equivalent of the native `FriendRow` — same data/actions (duel challenge, remove
 * friend), new Vaporwave/Luminous chrome. */
export function WebFriendRow({ friend, onRemove, isRemoving, onDuel }: WebFriendRowProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <WebAvatar username={friend.user.username} size={40} />
        <Text style={[type.title, styles.username]}>{friend.user.username}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Challenge ${friend.user.username} to a duel`}
          onPress={() => onDuel(friend)}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name="sports-kabaddi" size={20} color={colors.indigoPrimary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${friend.user.username} as a friend`}
          onPress={() => onRemove(friend.friendship_id)}
          disabled={isRemoving}
          style={({ hovered }) => [styles.removeButton, hovered && !isRemoving && styles.iconButtonHovered, isRemoving && styles.disabled]}>
          {isRemoving ? (
            <ActivityIndicator size="small" color={colors.foregroundMuted} />
          ) : (
            <Text style={[type.title, styles.removeLabel]}>Remove</Text>
          )}
        </Pressable>
      </View>
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
    username: {
      color: colors.foreground,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconButton: {
      height: 40,
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    iconButtonHovered: {
      backgroundColor: colors.hoverTint,
    },
    removeButton: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
    },
    removeLabel: {
      color: colors.accentDownvote,
    },
    disabled: {
      opacity: 0.5,
    },
  });
