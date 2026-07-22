import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import ChallengeDetailScreen from '@/features/challenges/ChallengeDetailScreen';
import type { RootState } from '@/store/store';

export default function ChallengeDetail() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { id, challengeId } = useLocalSearchParams<{ id: string; challengeId: string }>();
  if (!token) return <Redirect href="/login" />;
  return <ChallengeDetailScreen communityId={id} challengeId={challengeId} />;
}
