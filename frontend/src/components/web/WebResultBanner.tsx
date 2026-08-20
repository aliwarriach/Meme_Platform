import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebResultBannerProps {
  winnerName: string | null;
}

/**
 * Evaluated-challenge win/tie banner, shared by `DuelDetailScreen`/`ChallengeDetailScreen` (2
 * consumers — extracted per this codebase's own "extract on 2nd occurrence" convention).
 * Vaporwave/Luminous equivalent of the retired independent-theme `WebResultBanner` — reuses
 * Voting's own `WebWinnerBanner` language (glass card + `indigoGlow` decorative shadow +
 * `accentGold` achievement-tier trophy badge) for the identical semantic occasion: this is the
 * single "decided, celebratory" moment on these two screens, same reasoning `voting-web.md`
 * documents for its own winner banner. Winner name stays in plain `foreground` text (never
 * tinted) — differentiation is carried by the trophy badge fill and the surrounding glow, not by
 * coloring the headline itself, matching this migration's "never color-code body text" rule (see
 * compete-web.md's Accessibility section, same discipline `voting-web.md` established first).
 */
export function WebResultBanner({ winnerName }: WebResultBannerProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surfaceGlass, borderColor: colors.border, shadowColor: colors.indigoGlow },
      ]}>
      <View style={[styles.trophyBadge, { backgroundColor: colors.accentGold }]}>
        <MaterialIcons name="emoji-events" size={20} color={colors.onAccentInk} />
      </View>
      <Text style={[type.display, styles.text, { color: colors.foreground }]}>
        {winnerName ? `${winnerName} wins!` : 'Tie — no winner'}
      </Text>
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      borderRadius: radius.card,
      borderWidth: 1,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 20,
      elevation: 4,
    },
    trophyBadge: {
      height: 40,
      width: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    text: {
      textAlign: 'center',
    },
  });
