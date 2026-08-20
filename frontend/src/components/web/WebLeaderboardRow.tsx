import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

interface WebLeaderboardRowProps {
  rank: number;
  name: string;
  score: number;
  avatarUrl?: string | null;
  /** True for the signed-in viewer's own row (individual tab only — communities have no
   * equivalent "viewer" concept). Drives the elevated background + accent border + "You" badge
   * below, never a color-only signal (see doc comment). */
  isViewer?: boolean;
  accessibilityLabel: string;
}

/**
 * Shared ranked-list row for both Leaderboards tabs (Individual: rank/user/score; Communities:
 * rank/community/score). One component instead of two, unlike native's split
 * `IndividualLeaderboardRow`/`CommunityLeaderboardRow` — the two shapes only ever differed by
 * "avatar of a person" vs "initials tile of a community," and `WebAvatar` already renders a
 * plain initials fallback for any string when no `avatarUrl` is given, so passing a community's
 * name through the same prop reuses it directly rather than duplicating a second initials-fallback
 * implementation (this pass's explicit reuse instruction, same principle
 * `compete-web.md`'s `WebSideMemberPicker` reuse note already established for this codebase).
 *
 * Top-3 rank badge is now medal-tiered (gold/silver/bronze, ranks 1/2/3 respectively) instead of
 * one flat brand-pink fill for all three — a real signal upgrade, not a re-theme: "who's #1" used
 * to look identical to "who's #3." Rank 4+ stays a muted numeral, unchanged.
 *
 * "You" signal (Phase 2 finding, fixed here): native's `IndividualLeaderboardRow` marks the
 * viewer's row with a background tint ONLY (`bg-primary/10`) — a color-only signal a colorblind
 * or low-vision user can miss entirely, especially against a translucent glass card where the
 * tint reads faintly. This version pairs the tint with a solid "You" text badge in `accentCyan`
 * (contrast-verified, and deliberately distinct from both the pink brand fill and the medal
 * colors so it reads as its own "this is you" signal, not a 4th rank tier) plus a 3px
 * accent-colored left border, so the viewer's row is identifiable by shape/text, not color alone,
 * per the accessibility checklist's "color is never the only signal" rule.
 */
export function WebLeaderboardRow({ rank, name, score, avatarUrl, isViewer, accessibilityLabel }: WebLeaderboardRowProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const tierFill = rank === 1 ? colors.accentGold : rank === 2 ? colors.rankSilver : rank === 3 ? colors.rankBronze : undefined;
  const tierText = rank === 1 || rank === 2 ? colors.onAccentInk : colors.onAccent;
  const tierHover = rank === 1 ? colors.rankGoldHover : rank === 2 ? colors.rankSilverHover : rank === 3 ? colors.rankBronzeHover : undefined;

  return (
    <Pressable
      accessible
      accessibilityLabel={accessibilityLabel}
      style={({ hovered }: WebPressableState) => [
        styles.row,
        isViewer && styles.rowViewer,
        hovered && tierHover && { backgroundColor: tierHover, borderColor: tierFill },
        hovered && !tierHover && { backgroundColor: colors.surfaceHover },
      ]}>
      <View style={[styles.rankWrap, tierFill && { backgroundColor: tierFill }]}>
        <Text style={[type.title, { color: tierFill ? tierText : colors.foregroundMuted }]}>{rank}</Text>
      </View>

      <WebAvatar username={name} avatarUrl={avatarUrl} size={40} />

      <Text style={[type.body, styles.name, { color: colors.foreground }]} numberOfLines={1}>
        {name}
      </Text>

      {isViewer ? (
        <View style={[styles.youBadge, { backgroundColor: colors.accentCyan }]}>
          <Text style={[type.label, { color: colors.onAccent, fontSize: 10 }]}>You</Text>
        </View>
      ) : null}

      <Text style={[tierFill ? type.h2 : type.title, { color: colors.foreground, fontSize: tierFill ? 18 : 15 }]}>
        {score}
      </Text>
    </Pressable>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    rowViewer: {
      backgroundColor: colors.surfaceElevated,
      borderLeftWidth: 3,
      borderLeftColor: colors.indigoSecondary,
    },
    rankWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    name: {
      flex: 1,
    },
    youBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
  });
