import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebFriendsTopBarProps {
  title: string;
}

/** Per-page header for the web Friends screen — back button + title + the Vaporwave/Luminous
 * light-dark toggle, same shape as `WebFeedTopBar`/`WebCommunityTopBar`. Rebuilds the native
 * `TopBar`'s data/behavior with new chrome, since that component is native-resolved and aliases
 * the old NativeWind token set. */
export default function WebFriendsTopBar({ title }: WebFriendsTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <Text style={[type.h2, styles.title]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleMode}
          style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
          <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
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
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    left: {
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color: colors.foreground,
    },
    right: {
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
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
  });
