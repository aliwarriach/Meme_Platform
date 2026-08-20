import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

interface WebSettingsRowProps {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  /** Danger-zone rows (Log Out) render in `colors.error` instead of `foreground`/accent — a
   * second, non-color-only cue (no chevron) also distinguishes it, per the accessibility rule
   * that color is never the only signal. */
  destructive?: boolean;
}

/**
 * Settings-list row — Vaporwave/Luminous equivalent of the retired independent-theme
 * `WebSettingsRow`. 52px min height (comfortably above the 44px touch-target floor; ux-domain
 * skill query: `Touch Target Size`/High, `Touch Spacing`/Medium — 8px minimum gap, applied via the
 * list's own `gap`), full row is the hit target rather than just the label. Reused for both
 * nav-entry links (Friends, Communities, Compete, Competitions, Inbox) and destructive actions
 * (Log Out) — one consistent settings-row pattern instead of two different visual languages for
 * what is structurally the same kind of row, same reasoning the retired version used.
 *
 * Mode-conditional focus ring on this row too (the `WebVotingTopBar`/`WebLeaderboardsTopBar`
 * pattern) — the retired version had a fixed `colors.ring`; carried forward here as a
 * mode-conditional accent since Vaporwave's own accent tokens aren't safe as a fixed color across
 * both modes (see `WebProfileTopBar`'s doc comment).
 */
export default function WebSettingsRow({ label, icon, onPress, destructive = false }: WebSettingsRowProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  const tint = destructive ? colors.error : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        styles.root,
        hovered && { backgroundColor: colors.surfaceHover },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: -2 },
      ]}>
      <View style={styles.left}>
        <MaterialIcons name={icon} size={20} color={tint} />
        <Text style={[type.title, { color: tint }]}>{label}</Text>
      </View>
      {destructive ? null : <MaterialIcons name="chevron-right" size={20} color={colors.foregroundMuted} />}
    </Pressable>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.card,
      paddingHorizontal: spacing.lg,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
  });
