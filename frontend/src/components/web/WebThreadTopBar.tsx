import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebThreadTopBarProps {
  username: string;
  avatarUrl?: string | null;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Header for a single `/inbox/[conversationId]` thread page — back button (returns to wherever
 * the thread was opened from: the `/inbox` list, or the Feed screen's `WebFeedRail` preview, via
 * plain `router.back()`, same as every other Vaporwave drill-in screen) + the other participant's
 * avatar/username + the light/dark toggle. No "New Chat" action here — that's the list page's
 * job, not a single thread's.
 */
export default function WebThreadTopBar({ username, avatarUrl }: WebThreadTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ hovered, focused }: WebPressableState) => [
            styles.iconButton,
            hovered && styles.iconButtonHovered,
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>

        <WebAvatar username={username} avatarUrl={avatarUrl} size={32} />
        <Text style={[type.h2, styles.title]} numberOfLines={1}>
          {username}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onPress={toggleMode}
        style={({ hovered, focused }: WebPressableState) => [
          styles.iconButton,
          hovered && styles.iconButtonHovered,
          focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
        ]}>
        <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
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
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    left: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      color: colors.foreground,
      flexShrink: 1,
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
