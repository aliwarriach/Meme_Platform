import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useVotingWebTheme } from '@/constants/VotingWebTheme';
import { VOTING_WEB_RADIUS, VOTING_WEB_SPACING, VOTING_WEB_TYPE, type WebPressableState } from '@/constants/webVotingTheme';
import type { StandingContent, WinnerResponse } from '@/services/competitions';

interface WebWinnerBannerProps {
  winner: WinnerResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  label: string;
  onPress: (content: StandingContent) => void;
}

/**
 * The one place this pass puts the most energy, per the task's explicit balance instruction
 * ("winner states" is named as a place energy belongs) — gold-accent glow border + trophy badge +
 * large Anton "#1" numeral. Content thumbnail stays a plain neutral-bordered square so the meme
 * itself, not the chrome around it, stays the focal point.
 */
export function WebWinnerBanner({ winner, isLoading, isError, errorMessage, label, onPress }: WebWinnerBannerProps) {
  const { colors } = useVotingWebTheme();
  const content = winner?.content;
  const imageUrl = content?.kind === 'container' ? content.container.thumbnail_url : content?.meme.image_url;
  const authorName =
    content?.kind === 'container' ? content.container.submitter.username : content?.meme.author.username;
  const caption = content?.kind === 'container' ? content.container.title : content?.meme.caption;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.card, borderColor: colors.gold, shadowColor: colors.gold },
      ]}>
      <View style={styles.headerRow}>
        <View style={[styles.trophyBadge, { backgroundColor: colors.gold }]}>
          <MaterialIcons name="emoji-events" size={16} color={colors.onGold} />
        </View>
        <Text style={[VOTING_WEB_TYPE.label, { color: colors.goldText }]}>{label}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerPad}>
          <ActivityIndicator size="small" color={colors.foregroundMuted} />
        </View>
      ) : isError ? (
        <Text style={[VOTING_WEB_TYPE.body, { color: colors.foregroundMuted }]}>
          {errorMessage ?? "Couldn't load the winner."}
        </Text>
      ) : !content ? (
        <Text style={[VOTING_WEB_TYPE.body, { color: colors.foregroundMuted }]}>
          No votes were cast in that period.
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open winning entry by ${authorName}`}
          onPress={() => onPress(content)}
          style={({ hovered }: WebPressableState) => [styles.entryRow, hovered && { opacity: 0.9 }]}>
          <Text style={[VOTING_WEB_TYPE.display, { color: colors.goldText }]}>1</Text>

          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={[styles.thumb, { borderColor: colors.border }]} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              <MaterialIcons name="camera-alt" size={18} color={colors.foregroundMuted} />
            </View>
          )}

          <View style={styles.entryText}>
            <Text style={[VOTING_WEB_TYPE.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {authorName}
            </Text>
            {caption ? (
              <Text style={[VOTING_WEB_TYPE.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
            <Text style={[VOTING_WEB_TYPE.meta, styles.scoreText, { color: colors.primaryText }]}>
              score {winner.score}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: VOTING_WEB_RADIUS.card,
    borderWidth: 1.5,
    padding: VOTING_WEB_SPACING.lg,
    marginHorizontal: VOTING_WEB_SPACING.lg,
    marginBottom: VOTING_WEB_SPACING.lg,
    // Soft gold glow behind the card — energy on the winner state, not the canvas.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VOTING_WEB_SPACING.sm,
    marginBottom: VOTING_WEB_SPACING.md,
  },
  trophyBadge: {
    height: 26,
    width: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPad: {
    paddingVertical: VOTING_WEB_SPACING.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VOTING_WEB_SPACING.md,
  },
  thumb: {
    height: 56,
    width: 56,
    borderRadius: VOTING_WEB_RADIUS.chip,
    borderWidth: 1,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: {
    flex: 1,
    gap: 2,
  },
  scoreText: {
    marginTop: 2,
  },
});
