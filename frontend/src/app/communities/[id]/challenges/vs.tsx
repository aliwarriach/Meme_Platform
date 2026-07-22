import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import ProposeVsChallengeScreen from '@/features/challenges/ProposeVsChallengeScreen';
import type { RootState } from '@/store/store';

export default function ProposeVsChallenge() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!token) return <Redirect href="/login" />;
  return <ProposeVsChallengeScreen communityId={id} />;
}
