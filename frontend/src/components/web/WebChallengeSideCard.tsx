import { StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';
import WebCompeteButton from '@/components/web/WebCompeteButton';
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
 * One half of the VS matchup shown on `DuelDetailScreen`/`ChallengeDetailScreen`. The winning
 * side (once evaluated) gets this page's `outline` emphasis border — no hard shadow here, kept
 * one step quieter than the primary CTA/status cluster so it doesn't compete with the dedicated
 * `WebResultBanner` above it for "loudest element on screen."
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
  const { colors } = useCompeteWebTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        isWinner && { borderColor: colors.outline, borderWidth: 2 },
      ]}>
      <Text style={[COMPETE_WEB_TYPE.cardTitle, { color: colors.cardForeground }]} numberOfLines={1}>
        {side.name} {isViewerSide ? '(you)' : ''}
      </Text>
      {typeof side.score === 'number' ? (
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.primaryText }]}>Score: {side.score}</Text>
      ) : null}
      {showMemberCount ? (
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
          {side.member_ids.length} member{side.member_ids.length === 1 ? '' : 's'}
        </Text>
      ) : null}
      {showParticipantCount ? (
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
          {side.participant_count} joined
        </Text>
      ) : null}
      {onJoin ? (
        <View style={styles.joinButtonWrap}>
          <WebCompeteButton
            label={joinLabel ?? `Join ${side.name}`}
            variant="outline"
            onPress={onJoin}
            loading={joinLoading}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 4,
    borderRadius: COMPETE_WEB_RADIUS.card,
    borderWidth: 1,
    padding: COMPETE_WEB_SPACING.md,
  },
  joinButtonWrap: {
    marginTop: COMPETE_WEB_SPACING.sm,
  },
});
