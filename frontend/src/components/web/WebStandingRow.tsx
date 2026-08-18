import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useVotingWebTheme } from '@/constants/VotingWebTheme';
import { VOTING_WEB_RADIUS, VOTING_WEB_SPACING, VOTING_WEB_TYPE, type WebPressableState } from '@/constants/webVotingTheme';
import type { StandingContent, StandingEntryResponse } from '@/services/competitions';

interface WebStandingRowProps {
  entry: StandingEntryResponse;
  onPress: (content: StandingContent) => void;
}

/**
 * UX improvement over the native `StandingRow`: top-3 ranks get a gold-tinted numeral + badge
 * chip so scanning "who's winning" is faster at a glance — a real gap in the native row, which
 * renders every rank in identical plain text regardless of position. Ranks 4+ stay visually quiet
 * (muted numeral, no chip) so the top of the list keeps its priority.
 */
export function WebStandingRow({ entry, onPress }: WebStandingRowProps) {
  const { colors } = useVotingWebTheme();
  const { content } = entry;
  const isContainer = content.kind === 'container';
  const imageUrl = isContainer ? content.container.thumbnail_url : content.meme.image_url;
  const authorName = isContainer ? content.container.submitter.username : content.meme.author.username;
  const caption = isContainer ? content.container.title : content.meme.caption;
  const isTopThree = entry.rank <= 3;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank}, meme by ${authorName}, score ${entry.score}`}
      onPress={() => onPress(content)}
      style={({ hovered, focused }: WebPressableState) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
        hovered && { backgroundColor: colors.elevatedHover },
        focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      {/* Top-3 badge is a SOLID gold fill + dark text (same safe fill/onColor pairing as the
          trophy badge), not a tinted background with colored text — the tint variant measured
          under 4.5:1 AA for gold-on-tint in light mode (see webVotingTheme.ts). Ranks 4+ stay
          transparent, text sits directly on the card surface. */}
      <View style={[styles.rankWrap, isTopThree && { backgroundColor: colors.gold }]}>
        <Text style={[VOTING_WEB_TYPE.rankNumeral, { color: isTopThree ? colors.onGold : colors.foregroundMuted }]}>
          {entry.rank}
        </Text>
      </View>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.elevated }]}>
          <MaterialIcons name="camera-alt" size={16} color={colors.foregroundMuted} />
        </View>
      )}

      <View style={styles.textWrap}>
        <Text style={[VOTING_WEB_TYPE.title, { color: colors.foreground }]} numberOfLines={1}>
          {authorName}
        </Text>
        {caption ? (
          <Text style={[VOTING_WEB_TYPE.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>

      <Text style={[VOTING_WEB_TYPE.title, { color: isTopThree ? colors.goldText : colors.primaryText }]}>{entry.score}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VOTING_WEB_SPACING.md,
    borderRadius: VOTING_WEB_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: VOTING_WEB_SPACING.md,
    paddingVertical: VOTING_WEB_SPACING.sm,
    marginHorizontal: VOTING_WEB_SPACING.lg,
    marginBottom: VOTING_WEB_SPACING.sm,
  },
  rankWrap: {
    width: 32,
    height: 32,
    borderRadius: VOTING_WEB_RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: VOTING_WEB_RADIUS.chip,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
});
