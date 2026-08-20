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
  /** Icon-chip fill + icon-text pairing. Defaults to the brand pink pairing (`indigoSecondary`/
   * `onAccent`) for a generic stat; pass a different pair (e.g. `[colors.accentGold,
   * colors.onAccentInk]` for an achievement-flavored stat like badge count) so multiple cards on
   * the same screen don't all read as one undifferentiated pink block. */
  accentFill?: string;
  accentText?: string;
}

/**
 * Single stat card (Meme Score, badge count) — Vaporwave/Luminous equivalent of the retired
 * independent-theme `WebScoreCard`. Preserves the one real UX addition that card made over the
 * native screen's single centered-text score block: a Meme Score hero number gets more visual
 * weight than a plain text line, since it's the most scannable proof of standing on this screen
 * (the "returning core user" checks their score before anything else). Additive only, no new
 * fetch — both numbers come from queries the native screen already runs.
 *
 * The stat digit itself always stays `colors.foreground` — never a brand accent as text-bearing
 * foreground — per this system's own established rule (`voting-web.md`/`leaderboard-web.md`: "no
 * color-coded text sits directly on a background... differentiation is carried by badge/border
 * fills, never by tinting body text"). Differentiation between cards on the same screen is
 * carried by the icon chip's fill (pink by default, or an explicit `accentFill`/`accentText` pair
 * for a semantically distinct stat — e.g. Profile's Badges card uses gold, matching the
 * achievement-tier language `WebWinnerBanner`/rank-tier badges use elsewhere), not by recoloring
 * the number itself.
 */
export default function WebScoreCard({ label, value, isLoading, icon, accentFill, accentText }: WebScoreCardProps) {
  const { colors, type, radius, spacing, fontStack } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing, fontStack), [colors, radius, spacing, fontStack]);

  return (
    <View style={styles.root}>
      <View style={[styles.iconChip, { backgroundColor: accentFill ?? colors.indigoSecondary }]}>
        <MaterialIcons name={icon} size={16} color={accentText ?? colors.onAccent} />
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
