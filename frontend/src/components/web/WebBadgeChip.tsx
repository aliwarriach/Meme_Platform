import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebBadgeChipProps {
  label: string;
  points: number;
}

/**
 * Solid-fill badge chip — Vaporwave/Luminous equivalent of the retired independent-theme
 * `WebBadgeChip`. Solid `indigoSecondary` fill + `onAccent` text, never a tinted background with
 * colored text on top: the retired system's own audit found gold-as-text-on-tint failed 4.5:1, and
 * this system's own established rule (top-3 rank badge / selected tab / "You" badge, all
 * `voting-web.md`/`leaderboard-web.md`) is the same solid-fill treatment, reused verbatim here per
 * the cross-screen consistency check rather than inventing a second badge-chip language.
 */
export default function WebBadgeChip({ label, points }: WebBadgeChipProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  return (
    <View style={styles.root}>
      <MaterialIcons name="emoji-events" size={16} color={colors.onAccent} />
      <Text style={[type.meta, { color: colors.onAccent }]}>
        {label} · +{points}
      </Text>
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
      gap: spacing.xs,
      backgroundColor: colors.indigoSecondary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  });
