import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_SPACING, PROFILE_WEB_TYPE, type WebPressableState } from '@/constants/webProfileTheme';

interface WebProfileTopBarProps {
  title: string;
}

/** Per-page header for the profile web screen — title + a light/dark toggle. No back button:
 * Profile is a primary sidebar destination (`DesktopSidebarNav` has its own "Profile" item),
 * matching the native screen's own navigation model (reached via the bottom tab, not a drill-in
 * — no back affordance on the native `SessionScreen` either). Rebuilds chrome independently
 * rather than importing `WebVotingTopBar`, since that back button would be dead weight here —
 * same reasoning `WebCompeteTopBar` used for its own optional `showBack`. */
export default function WebProfileTopBar({ title }: WebProfileTopBarProps) {
  const { mode, colors, toggleMode } = useProfileWebTheme();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[PROFILE_WEB_TYPE.h2, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>

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
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PROFILE_WEB_SPACING.lg,
    paddingVertical: PROFILE_WEB_SPACING.lg,
    borderBottomWidth: 1,
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
