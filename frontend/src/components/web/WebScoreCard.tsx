import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebScoreCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
}

/**
 * Single stat card (Meme Score, badge count) — Vaporwave/Luminous equivalent of the retired
 * independent-theme `WebScoreCard`. Preserves the one real UX addition that card made over the
 * native screen's single centered-text score block: a Meme Score hero number gets more visual
 * weight than a plain text line, since it's the most scannable proof of standing on this screen
 * (the "returning core user" checks their score before anything else). Additive only, no new
 * fetch — both numbers come from queries the native screen already runs.
 *
 * The stat digit itself always stays `colors.foreground` — never `indigoPrimary`/`indigoSecondary`
 * as text-bearing foreground — per this system's own established rule (`voting-web.md`/
 * `leaderboard-web.md`: "no color-coded text sits directly on a background... differentiation is
 * carried by badge/border fills, never by tinting body text"). Differentiation between the two
 * cards is carried by the icon chip (solid `indigoSecondary` fill + `onAccent` icon, the same
 * measured 9.0:1 dark / 6.46:1 light pairing every badge/rank chip in this system reuses), not by
 * recoloring the number.
 */
export default function WebScoreCard({ label, value, isLoading, icon }: WebScoreCardProps) {
  const { colors, type, radius, spacing, fontStack } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing, fontStack), [colors, radius, spacing, fontStack]);

  return (
    <View style={styles.root}>
      <View style={styles.iconChip}>
        <MaterialIcons name={icon} size={16} color={colors.onAccent} />
      </View>
      <Text style={[type.label, styles.label, { color: colors.foregroundMuted }]}>{label}</Text>
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
      ) : (
        <Text style={[styles.stat, { color: colors.foreground }]}>{value ?? 0}</Text>
      )}
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
  fontStack: string,
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.card,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    iconChip: {
      width: 28,
      height: 28,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.indigoSecondary,
      marginBottom: spacing.sm,
    },
    label: {
      textAlign: 'center',
    },
    stat: {
      fontFamily: fontStack,
      fontWeight: '700',
      fontSize: 30,
      letterSpacing: -0.2,
      marginTop: spacing.xs,
    },
    spinner: {
      marginTop: spacing.sm,
    },
  });
