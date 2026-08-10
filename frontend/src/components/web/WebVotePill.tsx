import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_TYPE } from '@/constants/webFeedTheme';

interface WebVotePillProps {
  score: number;
  viewerVote: 1 | -1 | null;
  isVoting: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
}

/** Reddit-style ▲score▼ pill — this app never uses a heart/like icon (cross-screen
 * interaction-pattern precedent, MASTER.md's Component Conventions + Anti-Patterns). Restyled
 * for the "Dark Cinema" web feed: glass pill, glow behind the active arrow instead of a flat
 * fill. Color is never the only signal — each arrow also carries `accessibilityState.selected`
 * and a distinct icon direction, not color alone. */
export default function WebVotePill({ score, viewerVote, isVoting, onUpvote, onDownvote }: WebVotePillProps) {
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === 1 ? 'Remove upvote' : 'Upvote this meme'}
        accessibilityState={{ selected: viewerVote === 1, disabled: isVoting }}
        onPress={onUpvote}
        disabled={isVoting}
        style={({ hovered }) => [
          styles.arrowButton,
          viewerVote === 1 && styles.arrowActiveUp,
          hovered && viewerVote !== 1 && styles.arrowHovered,
          isVoting && styles.disabled,
        ]}>
        <Text style={[styles.arrow, { color: viewerVote === 1 ? FEED_WEB_COLORS.accentUpvote : FEED_WEB_COLORS.foregroundMuted }]}>
          ▲
        </Text>
      </Pressable>

      {/* Optimistically patched — never swapped for a spinner, dimming is the only in-flight signal. */}
      <Text style={[FEED_WEB_TYPE.voteScore, styles.score, isVoting && styles.disabled]}>{score}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === -1 ? 'Remove downvote' : 'Downvote this meme'}
        accessibilityState={{ selected: viewerVote === -1, disabled: isVoting }}
        onPress={onDownvote}
        disabled={isVoting}
        style={({ hovered }) => [
          styles.arrowButton,
          viewerVote === -1 && styles.arrowActiveDown,
          hovered && viewerVote !== -1 && styles.arrowHovered,
          isVoting && styles.disabled,
        ]}>
        <Text style={[styles.arrow, { color: viewerVote === -1 ? FEED_WEB_COLORS.accentDownvote : FEED_WEB_COLORS.foregroundMuted }]}>
          ▼
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: FEED_WEB_RADIUS.pill,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.border,
    backgroundColor: FEED_WEB_COLORS.surfaceElevated,
    paddingHorizontal: 4,
  },
  arrowButton: {
    minHeight: 44,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FEED_WEB_RADIUS.pill,
  },
  arrowHovered: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  arrowActiveUp: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  arrowActiveDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  arrow: {
    fontSize: 15,
  },
  score: {
    minWidth: 28,
    textAlign: 'center',
    color: FEED_WEB_COLORS.foreground,
  },
  disabled: {
    opacity: 0.55,
  },
});
