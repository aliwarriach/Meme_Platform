import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';

interface WebCompeteTopBarProps {
  title: string;
  /** Only `CompeteScreen` (the list root) has no "back" — every drill-in/form screen does. */
  showBack?: boolean;
  rightAction?: ReactNode;
}

/** Per-page header for the Compete/Challenges web screens — back button (optional) + title +
 * a light/dark toggle + an optional extra action slot (e.g. CompeteScreen's "start open
 * challenge" button). Rebuilds the native `TopBar`'s data/behavior with new chrome, since that
 * component is native-resolved and aliases the old token set — same precedent every prior web
 * pass used for its own top bar. */
export default function WebCompeteTopBar({ title, showBack = true, rightAction }: WebCompeteTopBarProps) {
  const router = useRouter();
  const { mode, colors, toggleMode } = useCompeteWebTheme();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
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

      <Text
        style={[COMPETE_WEB_TYPE.h2, styles.title, { color: colors.foreground }]}
        numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {rightAction}
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
          <MaterialIcons
            name={mode === 'dark' ? 'light-mode' : 'dark-mode'}
            size={20}
            color={colors.cardForeground}
          />
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
    paddingHorizontal: COMPETE_WEB_SPACING.lg,
    paddingVertical: COMPETE_WEB_SPACING.lg,
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
    gap: COMPETE_WEB_SPACING.sm,
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
