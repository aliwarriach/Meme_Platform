import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import DuelDetailScreen from '@/features/challenges/DuelDetailScreen';
import type { RootState } from '@/store/store';

export default function FlatChallengeDetail() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  if (!token) return <Redirect href="/login" />;
  return <DuelDetailScreen challengeId={challengeId} />;
}
