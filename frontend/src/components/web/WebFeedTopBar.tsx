import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING, FEED_WEB_TYPE } from '@/constants/webFeedTheme';
import { useUnreadNotificationCount } from '@/services/useNotifications';

interface WebFeedTopBarProps {
  onShareInstagramLink: () => void;
}

/** Per-column header for the web feed pilot (Twitter/Discord-style — scoped to the feed's own
 * content column, not full app width; the persistent nav lives in `DesktopSidebarNav`). Rebuilds
 * `TopBar` + `NotificationBell`'s data/behavior with new chrome rather than reusing those
 * components directly, since both are native-resolved shared files. */
export default function WebFeedTopBar({ onShareInstagramLink }: WebFeedTopBarProps) {
  const router = useRouter();
  const unreadQuery = useUnreadNotificationCount();
  const unreadCount = unreadQuery.data?.count ?? 0;

  return (
    <View style={styles.root}>
      <Text style={[FEED_WEB_TYPE.display, styles.brand]}>MemeVerse</Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share an Instagram Reel"
          onPress={onShareInstagramLink}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name="add-link" size={20} color={FEED_WEB_COLORS.foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          onPress={() => router.push('/notifications')}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name="notifications-none" size={20} color={FEED_WEB_COLORS.foreground} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingVertical: FEED_WEB_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: FEED_WEB_COLORS.border,
  },
  brand: {
    color: FEED_WEB_COLORS.foreground,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.sm,
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FEED_WEB_RADIUS.pill,
  },
  iconButtonHovered: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
    height: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FEED_WEB_RADIUS.pill,
    paddingHorizontal: 3,
    backgroundColor: FEED_WEB_COLORS.accentDownvote,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 10,
    fontWeight: '700',
    color: FEED_WEB_COLORS.onAccent,
  },
});
