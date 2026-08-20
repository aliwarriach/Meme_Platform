import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebVotingTopBarProps {
  title: string;
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * Defined locally (not shared) per this codebase's established precedent — every independent
 * web-theme tree (compete/community/profile) keeps its own copy rather than importing a shared
 * one. */
interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Per-page header for the web Voting/Competitions screen — back button + title + the
 * Vaporwave/Luminous light-dark toggle, same shape as `WebFriendsTopBar`/`WebFeedTopBar`
 * (cross-screen nav-pattern precedent: drill-in web screens with no `FloatingBottomNav`
 * destination use back-button-only chrome, matched here rather than inventing a new one).
 * Replaces the retired independent-theme `WebVotingTopBar` (see voting-web.md migration notes).
 * No bottom-nav destination exists for Voting (`FloatingBottomNav`'s `NavDestination` union
 * doesn't include it, `DesktopSidebarNav` has its own separate "Voting" link) — matches Friends,
 * which is also nav-less for the same reason.
 */
export default function WebVotingTopBar({ title }: WebVotingTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  // Focus-ring color must be mode-conditional, not a fixed token: indigoPrimary (bright cyan)
  // measures ~11.7:1 against the dark canvas but only ~1.7:1 against the light canvas (fails
  // WCAG 1.4.11's 3:1 non-text minimum) — indigoSecondary (magenta) is the inverse, ~6.5:1 on
  // light vs too-close-in-luminance on dark. Picking the token that actually clears 3:1 in each
  // mode, computed via the standard relative-luminance formula, not eyeballed.
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
