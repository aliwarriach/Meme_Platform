import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { ChallengeResponse } from '@/services/challenges';

interface ChallengeResultCardProps {
  challenge: ChallengeResponse;
}

/** A challenge on this tag that finished within the last 24h (Roadmap_Search.md S5 step 3)
 * — winner highlighted, "Final" where the countdown was. Renders below `ChallengeRaceHeader`
 * when both are present: a new challenge can claim a tag whose predecessor is still inside
 * its 24h result window (see `.claude/memory/challenges.md` S1). */
export function ChallengeResultCard({ challenge }: ChallengeResultCardProps) {
  const router = useRouter();
  const winningSide = challenge.sides.find((side) => side.id === challenge.winning_side_id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View results for ${challenge.title}`}
      onPress={() =>
        router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } })
      }
      className="mx-4 mt-3 rounded-card border border-outline-variant/40 bg-surface-high/60 p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-title text-base text-heading" numberOfLines={1}>
          {challenge.title}
        </Text>
        <Text className="font-label text-xs uppercase text-ink-muted">Final</Text>
      </View>

      <Text className="mb-2 font-heading text-sm text-primary-dim">
        {winningSide ? `🏆 ${winningSide.name} wins` : 'Tie — no winner'}
      </Text>

      <View className="gap-1">
        {challenge.sides.map((side) => (
          <View key={side.id} className="flex-row items-center justify-between">
            <Text
              className={`font-body text-sm ${side.id === winningSide?.id ? 'text-heading' : 'text-ink-muted'}`}
              numberOfLines={1}>
              {side.name}
            </Text>
            <Text className="font-body text-xs text-ink-muted">{side.score ?? 0} pts</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
