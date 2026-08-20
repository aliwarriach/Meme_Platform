import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { ChallengeStatus } from '@/services/challenges';

interface WebChallengeStatusBadgeProps {
  status: ChallengeStatus;
  /** Adds a soft `indigoGlow` shadow — reserved for `active` in list contexts (`CompeteScreen`),
   * off by default elsewhere (detail screens already carry their own emphasis via the
   * surrounding status cluster / `WebResultBanner`). */
  emphasize?: boolean;
}

/**
 * Centralizes the status→color mapping previously copy-pasted three times (native `ChallengeRow`,
 * `ChallengeDetailScreen`, `DuelDetailScreen` each redeclared their own `STATUS_STYLES`) — no
 * informational change, one source of truth. Vaporwave/Luminous equivalent of the retired
 * independent-theme `WebChallengeStatusBadge`.
 *
 * Neon Plum gives each of the three real `ChallengeStatus` values ("setup" | "active" |
 * "evaluated") its own hue instead of the old system's brand-pink-for-active +
 * neutral-for-everything-else:
 * - `setup` (pending, awaiting accept/decline) → solid `accentAmber` fill + `onAccentInk` text,
 *   labeled "Pending" — amber is this system's warning/in-progress hue, distinct from `accentGold`
 *   (achievement/celebration only, e.g. rank #1 and winner trophies) so "you need to decide
 *   something" and "you won something" never share a color.
 * - `active` (still running, the "act now" state) → solid `success` fill + `onAccent` white text
 *   (5.01:1/AA in both modes) — green reads as "in progress," and no longer doubles as the same
 *   brand pink every other filled element uses, so a glance at a challenge list can tell "pending
 *   vs. active vs. done" apart by color alone (backed by the label text too, never color-only).
 * - `evaluated` (decided) → an outline pill in `accentPurple` (verified text-on-canvas contrast
 *   in both modes, not the old mode-conditional pink-ring swap) — matching Voting's own "Final"
 *   treatment for a settled/no-longer-live state. The celebratory emphasis for a win lives in the
 *   dedicated `WebResultBanner` instead of this small badge, so it isn't fighting itself for
 *   "loudest element on screen."
 */
export function WebChallengeStatusBadge({ status, emphasize = false }: WebChallengeStatusBadgeProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);

  const label = status === 'setup' ? 'Pending' : status === 'active' ? 'Active' : 'Evaluated';

  if (status === 'active') {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: colors.success },
          emphasize && {
            shadowColor: colors.success,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 10,
            elevation: 3,
          },
        ]}>
        <Text style={[type.label, { color: colors.onAccent }]}>{label}</Text>
      </View>
    );
  }

  if (status === 'evaluated') {
    return (
      <View style={[styles.badge, styles.outline, { borderColor: colors.accentPurple }]}>
        <Text style={[type.label, { color: colors.accentPurple }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: colors.accentAmber }]}>
      <Text style={[type.label, { color: colors.onAccentInk }]}>{label}</Text>
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    outline: {
      borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
  });
