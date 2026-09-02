import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import PillButton from '@/components/PillButton';
import { CountdownTimer } from '@/features/challenges/components/CountdownTimer';
import type { ChallengeResponse } from '@/services/challenges';

interface ChallengeRaceHeaderProps {
  challenge: ChallengeResponse;
}

/** The tag screen's event-like live-race block, driven by `HashtagOut.active_challenge`
 * (Roadmap_Search.md S5 step 2). Two sides get the head-to-head bar treatment; the setup
 * schema permits more (`OpenChallengeCreate.sides` has no max), so 3+ degrade to a ranked
 * list rather than breaking the layout. */
export function ChallengeRaceHeader({ challenge }: ChallengeRaceHeaderProps) {
  const router = useRouter();

  const sides = challenge.sides;
  const scores = sides.map((side) => side.score ?? 0);
  const totalScore = scores.reduce((sum, score) => sum + Math.max(score, 0), 0);
  const isHeadToHead = sides.length === 2;
  const mySide = sides.find((side) => side.id === challenge.viewer_side_id);

  const onPrimaryCta = () => {
    if (mySide) {
      router.push({ pathname: '/new-post', params: { challengeId: challenge.id } });
    } else {
      router.push({ pathname: '/challenges/[challengeId]', params: { challengeId: challenge.id } });
    }
  };

  return (
    <View
      accessibilityRole="summary"
      className="mx-4 mt-3 rounded-card border border-primary/40 bg-primary/10 p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-title text-base text-heading" numberOfLines={1}>
          🏆 {challenge.title}
        </Text>
        <CountdownTimer endTime={challenge.end_time} className="font-body text-xs text-ink-muted" />
      </View>

      {isHeadToHead ? (
        <View className="mb-1 h-3 flex-row overflow-hidden rounded-full bg-surface-high">
          {sides.map((side, index) => {
            const share = totalScore > 0 ? Math.max(scores[index], 0) / totalScore : 0.5;
            return (
              <View
                key={side.id}
                style={{ flexGrow: share, flexBasis: 0 }}
                className={index === 0 ? 'bg-primary' : 'bg-secondary'}
              />
            );
          })}
        </View>
      ) : null}

      <View className={isHeadToHead ? 'flex-row justify-between' : 'gap-2'}>
        {sides
          .map((side, index) => ({ side, score: scores[index] }))
          .sort((a, b) => (isHeadToHead ? 0 : b.score - a.score))
          .map(({ side, score }) => (
            <View key={side.id} className={isHeadToHead ? 'flex-1' : 'flex-row items-center justify-between'}>
              <Text className="font-title text-sm text-heading" numberOfLines={1}>
                {side.name}
                {side.id === mySide?.id ? ' (you)' : ''}
              </Text>
              <Text className="font-body text-xs text-ink-muted">{score} pts</Text>
            </View>
          ))}
      </View>

      {mySide ? (
        <Text className="mb-2 mt-3 font-body text-xs text-primary-dim">You&apos;re on {mySide.name}</Text>
      ) : null}
      <PillButton
        label={mySide ? 'Post to this challenge' : 'Pick a side'}
        onPress={onPrimaryCta}
        className={mySide ? 'mt-1' : 'mt-3'}
      />
    </View>
  );
}
