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
 * Reuses MASTER.md's own established three-color semantic (`ChallengeRow.tsx`'s
 * active→vivid / evaluated→brand / setup→neutral mapping, which MASTER.md explicitly asks
 * future compete/challenge web work to reuse) translated onto Vaporwave's own token set, not its
 * exact hexes:
 * - `active` (still running, the "act now" state) → solid `indigoSecondary` fill + `onAccent`
 *   text — the same "solid fill = live/urgent" convention `WebVotingTabs`'s selected state and
 *   Voting's own "Live" period badge both already use (verified 9.0:1 dark / 6.46:1 light).
 * - `evaluated` (decided) → an outline pill (mode-conditional accent border + text, same
 *   `indigoPrimary`-dark/`indigoSecondary`-light pattern as every focus ring in this migration),
 *   matching Voting's own "Final" treatment for a settled/no-longer-live state. The celebratory
 *   emphasis for a win lives in the dedicated `WebResultBanner` instead of this small badge, so
 *   it isn't fighting itself for "loudest element on screen."
 * - `setup` (pending, not yet started/awaiting accept-decline) → neutral `surfaceElevated` fill +
 *   `foregroundMuted` text, labeled "Pending" — no informational change from native.
 *
 * `accentUpvote` (Vaporwave's other saturated hue) is deliberately NOT used here: it fails as a
 * white-text fill in both modes (2.28:1 light / measured via the same WCAG formula the rest of
 * this migration uses — under 4.5:1 AA) and Vaporwave has no dedicated text-safe derived tint for
 * it the way the retired system's `accentText` role did — see compete-web.md's Accessibility
 * section for the full reasoning this ruled it out.
 */
export function WebChallengeStatusBadge({ status, emphasize = false }: WebChallengeStatusBadgeProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const accent = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  const label = status === 'setup' ? 'Pending' : status === 'active' ? 'Active' : 'Evaluated';

  if (status === 'active') {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: colors.indigoSecondary },
          emphasize && {
            shadowColor: colors.indigoGlow,
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
      <View style={[styles.badge, styles.outline, { borderColor: accent }]}>
        <Text style={[type.label, { color: accent }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[type.label, { color: colors.foregroundMuted }]}>{label}</Text>
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
