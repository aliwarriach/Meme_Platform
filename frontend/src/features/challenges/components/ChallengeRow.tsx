import { Pressable, Text, View } from 'react-native';

import type { ChallengeResponse } from '@/services/challenges';

interface ChallengeRowProps {
  challenge: ChallengeResponse;
  onPress: () => void;
}

const STATUS_STYLES: Record<ChallengeResponse['status'], string> = {
  active: 'bg-green-500',
  evaluated: 'bg-orange-500',
  setup: 'bg-neutral-300 dark:bg-neutral-700',
};

export function ChallengeRow({ challenge, onPress }: ChallengeRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open challenge ${challenge.title}`}
      onPress={onPress}
      className="mb-2 flex-row items-center justify-between rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <View className="flex-1">
        <Text className="font-bold text-neutral-900 dark:text-white">{challenge.title}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {challenge.sides.map((s) => s.name).join(' vs ')}
        </Text>
      </View>
      <View className={`rounded-full px-2 py-1 ${STATUS_STYLES[challenge.status]}`}>
        <Text className="text-xs font-bold uppercase text-white">
          {challenge.status === 'setup' ? 'Pending' : challenge.status}
        </Text>
      </View>
    </Pressable>
  );
}
