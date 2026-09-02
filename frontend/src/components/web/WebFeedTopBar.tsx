import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useUnreadNotificationCount } from '@/services/useNotifications';

interface WebFeedTopBarProps {
  onShareInstagramLink: () => void;
  /** Only passed on narrow/mobile-width web — at desktop width `DesktopSidebarNav` already
   * shows these sections permanently, so no hamburger is needed there. */
  onOpenMenu?: () => void;
}

/** Per-column header for the web feed pilot (Twitter/Discord-style — scoped to the feed's own
 * content column, not full app width; the persistent nav lives in `DesktopSidebarNav`). Rebuilds
 * `TopBar` + `NotificationBell`'s data/behavior with new chrome rather than reusing those
 * components directly, since both are native-resolved shared files. Also hosts the feed's
 * light/dark toggle (RESKIN MODE, 2026-08-19) — natural home alongside the other icon-button
 * affordances (share/notifications). */
export default function WebFeedTopBar({ onShareInstagramLink, onOpenMenu }: WebFeedTopBarProps) {
  const router = useRouter();
  const unreadQuery = useUnreadNotificationCount();
  const unreadCount = unreadQuery.data?.count ?? 0;
  const { colors: FEED_WEB_COLORS, type: FEED_WEB_TYPE, radius: FEED_WEB_RADIUS, spacing: FEED_WEB_SPACING, mode, toggleMode } =
    useVaporwaveTheme();
  const styles = useMemo(() => createStyles(FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING), [FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING]);

  return (
    <View style={styles.root}>
      <View style={styles.leftGroup}>
        {onOpenMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            onPress={onOpenMenu}
            style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons name="menu" size={20} color={FEED_WEB_COLORS.foreground} />
          </Pressable>
        ) : null}
        <Text style={[FEED_WEB_TYPE.display, styles.brand]}>MOSH</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => router.push('/search')}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name="search" size={20} color={FEED_WEB_COLORS.foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleMode}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={FEED_WEB_COLORS.foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share an Instagram Reel"
          onPress={onShareInstagramLink}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          {/* accentCyan — this system's share/send-action hue (see WebMemeCard), not the neutral
              foreground every other top-bar icon uses, since this one specifically imports
              outside content rather than just navigating within the app. */}
          <MaterialIcons name="add-link" size={20} color={FEED_WEB_COLORS.accentCyan} />
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

const createStyles = (
  FEED_WEB_COLORS: VaporwaveTheme['colors'],
  FEED_WEB_RADIUS: VaporwaveTheme['radius'],
  FEED_WEB_SPACING: VaporwaveTheme['spacing'],
) => StyleSheet.create({
  root: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FEED_WEB_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: FEED_WEB_COLORS.border,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.sm,
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
    backgroundColor: FEED_WEB_COLORS.hoverTint,
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
    // Brand pink, not `accentDownvote` — an unread count isn't an error/negative signal, it
    // shouldn't borrow the vote-downvote red.
    backgroundColor: FEED_WEB_COLORS.indigoSecondary,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 10,
    fontWeight: '700',
    color: FEED_WEB_COLORS.onAccent,
  },
});
