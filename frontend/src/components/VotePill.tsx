import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type VotePillProps = {
  score: number;
  viewerVote: 1 | -1 | null;
  isVoting: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
};

/** Reddit-style ▲ score ▼ control — the app never uses a heart/like icon; this single pill both reacts and ranks. */
export default function VotePill({ score, viewerVote, isVoting, onUpvote, onDownvote }: VotePillProps) {
  return (
    <View className="flex-row items-center rounded-full border border-outline-variant bg-surface-high/70 px-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === 1 ? 'Remove upvote' : 'Upvote this meme'}
        accessibilityState={{ selected: viewerVote === 1, disabled: isVoting }}
        onPress={onUpvote}
        disabled={isVoting}
        className="min-h-[44px] min-w-[36px] items-center justify-center disabled:opacity-50">
        <Text className={`text-base ${viewerVote === 1 ? 'text-primary' : 'text-ink-muted'}`}>▲</Text>
      </Pressable>

      {isVoting ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Text className="min-w-[28px] text-center font-title text-sm text-heading">{score}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewerVote === -1 ? 'Remove downvote' : 'Downvote this meme'}
        accessibilityState={{ selected: viewerVote === -1, disabled: isVoting }}
        onPress={onDownvote}
        disabled={isVoting}
        className="min-h-[44px] min-w-[36px] items-center justify-center disabled:opacity-50">
        <Text className={`text-base ${viewerVote === -1 ? 'text-secondary' : 'text-ink-muted'}`}>▼</Text>
      </Pressable>
    </View>
  );
}
