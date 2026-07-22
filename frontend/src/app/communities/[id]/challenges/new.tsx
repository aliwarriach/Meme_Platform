import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import CreateChallengeScreen from '@/features/challenges/CreateChallengeScreen';
import type { RootState } from '@/store/store';

export default function NewChallenge() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!token) return <Redirect href="/login" />;
  return <CreateChallengeScreen communityId={id} />;
}
