import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebProfileTopBarProps {
  title: string;
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * Defined locally, not shared — matches every other Vaporwave screen's own local copy
 * (`WebVotingTopBar`, `WebLeaderboardsTopBar`). */
interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Per-page header for the web Profile/Session screen — title + the Vaporwave/Luminous light-dark
 * toggle. Vaporwave/Luminous equivalent of the retired independent-theme `WebProfileTopBar` (see
 * `pages/profile-web.md` migration notes). No back button, same as the retired version and
 * matching every other bottom-nav-destination web screen (`FeedScreen.web.tsx`,
 * `CompeteScreen.web.tsx`): Profile is reached via `DesktopSidebarNav`'s own "Profile" item and
 * `FloatingBottomNav`'s `profile` tab, not a drill-in — no back affordance on the native
 * `SessionScreen` either.
 *
 * Built with a visible keyboard focus ring from the start (the mode-conditional accent every
 * later Vaporwave topbar — `WebVotingTopBar`, `WebLeaderboardsTopBar` — standardized on, after
 * `WebFriendsTopBar`/`WebFeedTopBar` shipped without one).
 */
export default function WebProfileTopBar({ title }: WebProfileTopBarProps) {
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  // Focus-ring color must be mode-conditional, not a fixed token: indigoPrimary (bright cyan)
  // measures ~11.7:1 against the dark canvas but only ~1.7:1 against the light canvas (fails
  // WCAG 1.4.11's 3:1 non-text minimum); indigoSecondary (magenta) is the inverse. Same reasoning
  // `voting-web.md`/`leaderboard-web.md` already established, carried forward unchanged.
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={styles.root}>
      <Text style={[type.h2, styles.title]} numberOfLines={1}>
        {title}
      </Text>

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
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.foreground,
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
