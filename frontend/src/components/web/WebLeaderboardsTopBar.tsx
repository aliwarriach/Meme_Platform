import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebLeaderboardsTopBarProps {
  title: string;
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * Defined locally, not shared — matches every other Vaporwave screen's own local copy
 * (`WebVotingTopBar`, `WebCompeteTopBar`). */
interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Per-page header for the web Leaderboards screen — back button + title + the Vaporwave/Luminous
 * light-dark toggle. Same shape as `WebVotingTopBar` (the closest structural precedent: another
 * standalone, no-bottom-nav, drill-in ranked-list screen), including its focus-ring fix over the
 * older `WebFriendsTopBar`/`WebFeedTopBar` copies that never got one (flagged, not fixed, in
 * `voting-web.md` as out of scope for that pass — not repeated here since this is a new file).
 */
export default function WebLeaderboardsTopBar({ title }: WebLeaderboardsTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  // Focus-ring color must be mode-conditional, not a fixed token: indigoPrimary (bright cyan)
  // measures ~11.7:1 against the dark canvas but only ~1.7:1 against the light canvas (fails
  // WCAG 1.4.11's 3:1 non-text minimum) — indigoSecondary (magenta) is the inverse. Same
  // reasoning `voting-web.md`/`compete-web.md` already established, carried forward unchanged.
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
      </View>

      <Text style={[type.h2, styles.title]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
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
