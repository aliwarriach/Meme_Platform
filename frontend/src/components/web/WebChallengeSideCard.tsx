import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { ChallengeSideResponse } from '@/services/challenges';

interface WebChallengeSideCardProps {
  side: ChallengeSideResponse;
  isViewerSide: boolean;
  isWinner: boolean;
  /** `community_vs_community` sides have no fixed member roster — hide the count instead of
   * showing a misleading `0 members`, matching native `ChallengeDetailScreen`'s own branch. */
  showMemberCount: boolean;
  /** `open` challenges only — unbounded roster, shown as a live join count instead. */
  showParticipantCount: boolean;
  onJoin?: () => void;
  joinLabel?: string;
  joinLoading?: boolean;
}

/**
 * One half of the VS matchup shown on `DuelDetailScreen`/`ChallengeDetailScreen`. Vaporwave/
 * Luminous equivalent of the retired independent-theme `WebChallengeSideCard`. The winning side
 * (once evaluated) gets a small solid `indigoSecondary` + `onAccent` "Winner" chip — the same
 * "solid fill, never a colored border/text-on-tint" convention this whole migration follows (a
 * colored border here would repeat the exact contrast failure the accessibility pass ruled out
 * for `indigoSecondary` against a dark card, ~1.6-1.9:1, under 3:1) — kept one step quieter than
 * `WebResultBanner` above it so the banner stays "loudest element on screen."
 */
export function WebChallengeSideCard({
  side,
  isViewerSide,
  isWinner,
  showMemberCount,
  showParticipantCount,
  onJoin,
  joinLabel,
  joinLoading,
}: WebChallengeSideCardProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
      {isWinner ? (
        <View style={[styles.winnerChip, { backgroundColor: colors.indigoSecondary }]}>
          <MaterialIcons name="emoji-events" size={12} color={colors.onAccent} />
          <Text style={[type.meta, styles.winnerChipText, { color: colors.onAccent }]}>Winner</Text>
        </View>
      ) : null}
      <Text style={[type.title, { color: colors.foreground }]} numberOfLines={1}>
        {side.name} {isViewerSide ? '(you)' : ''}
      </Text>
      {typeof side.score === 'number' ? (
        <Text style={[type.meta, { color: colors.foreground }]}>Score: {side.score}</Text>
      ) : null}
      {showMemberCount ? (
        <Text style={[type.meta, { color: colors.foregroundMuted }]}>
          {side.member_ids.length} member{side.member_ids.length === 1 ? '' : 's'}
        </Text>
      ) : null}
      {showParticipantCount ? (
        <Text style={[type.meta, { color: colors.foregroundMuted }]}>{side.participant_count} joined</Text>
      ) : null}
      {onJoin ? (
        <View style={styles.joinButtonWrap}>
          <WebCompeteButton label={joinLabel ?? `Join ${side.name}`} variant="outline" onPress={onJoin} loading={joinLoading} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    card: {
      flex: 1,
      gap: 4,
      borderRadius: radius.card,
      borderWidth: 1,
      padding: spacing.md,
    },
    winnerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginBottom: 2,
    },
    winnerChipText: {
      textTransform: 'uppercase',
    },
    joinButtonWrap: {
      marginTop: spacing.sm,
    },
  });
