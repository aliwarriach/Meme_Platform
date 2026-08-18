import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, type WebPressableState } from '@/constants/webCommunityTheme';

interface WebCommunityTopBarProps {
  title: string;
  showBack?: boolean;
  rightActions?: ReactNode;
}

/** Per-page header for the community web pages — title + optional back + a light/dark toggle
 * (always present, since this tree is the only one in the app with a theme switch) + a slot for
 * page-specific actions (e.g. "Create" on the discover screen, the pending-requests badge on
 * detail). Rebuilds the native `TopBar`'s data/behavior with new chrome, since that component is
 * native-resolved and aliases the old token set. */
export default function WebCommunityTopBar({ title, showBack = false, rightActions }: WebCommunityTopBarProps) {
  const router = useRouter();
  const { mode, colors, toggleMode } = useCommunityWebTheme();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ hovered, focused }: WebPressableState) => [
              styles.iconButton,
              hovered && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[COMMUNITY_WEB_TYPE.h2, styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {rightActions}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleMode}
          style={({ hovered, focused }: WebPressableState) => [
            styles.iconButton,
            { backgroundColor: colors.elevated },
            hovered && { backgroundColor: colors.elevatedHover },
            focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
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
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.lg,
    borderBottomWidth: 1,
  },
  left: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
