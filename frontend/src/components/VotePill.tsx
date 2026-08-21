import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from '@/constants/ThemeMode';
import { Pressable, Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

type VotePillProps = {
  score: number;
  viewerVote: 1 | -1 | null;
  isVoting: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
};

/** Separate up/down circular buttons with the score between them — replaces the old single
 * ▲score▼ pill with the same unified vote control the community feed already used, now shared
 * by every meme card (personal feed, community feed, Instagram Companion containers). */
export default function VotePill({ score, viewerVote, isVoting, onUpvote, onDownvote }: VotePillProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === 1 ? 'Remove upvote' : 'Upvote this meme'}
        accessibilityState={{ selected: viewerVote === 1, disabled: isVoting }}
        onPress={onUpvote}
        disabled={isVoting}
        className="h-9 w-9 items-center justify-center rounded-full disabled:opacity-50">
        <MaterialIcons name="arrow-upward" size={18} color={viewerVote === 1 ? c.accentUpvote : c.inkMuted} />
      </Pressable>

      {/* The score is patched optimistically, so it already shows the post-vote value the
          instant the arrow is tapped — never swap it for a spinner, which would blank out
          the one number the user is looking at. Dimming is the whole in-flight signal. */}
      <Text
        className={`min-w-[20px] text-center font-title text-sm text-heading ${
          isVoting ? 'opacity-60' : ''
        }`}>
        {score}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === -1 ? 'Remove downvote' : 'Downvote this meme'}
        accessibilityState={{ selected: viewerVote === -1, disabled: isVoting }}
        onPress={onDownvote}
        disabled={isVoting}
        className="h-9 w-9 items-center justify-center rounded-full disabled:opacity-50">
        <MaterialIcons name="arrow-downward" size={18} color={viewerVote === -1 ? c.accentDownvote : c.inkMuted} />
      </Pressable>
    </View>
  );
}
