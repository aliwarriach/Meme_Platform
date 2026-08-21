import { Pressable, Text, View } from 'react-native';

import type { ChallengeResponse } from '@/services/challenges';

interface ChallengeRowProps {
  challenge: ChallengeResponse;
  onPress: () => void;
}

const STATUS_STYLES: Record<ChallengeResponse['status'], string> = {
  active: 'bg-tertiary',
  evaluated: 'bg-primary-container',
  setup: 'bg-surface-high',
};

export function ChallengeRow({ challenge, onPress }: ChallengeRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open challenge ${challenge.title}`}
      onPress={onPress}
      className="mb-2 flex-row items-center justify-between rounded-card border border-outline-variant/30 bg-surface p-3">
      <View className="flex-1">
        <Text className="font-title text-heading">{challenge.title}</Text>
        <Text className="font-body text-xs text-ink-muted">
          {challenge.sides.map((s) => s.name).join(' vs ')}
        </Text>
      </View>
      <View className={`rounded-full px-3 py-1 ${STATUS_STYLES[challenge.status]}`}>
        <Text className="font-label text-xs uppercase text-white">
          {challenge.status === 'setup' ? 'Pending' : challenge.status}
        </Text>
      </View>
    </Pressable>
  );
}
