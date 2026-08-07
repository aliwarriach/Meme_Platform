import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import CreateOpenChallengeScreen from '@/features/challenges/CreateOpenChallengeScreen';
import type { RootState } from '@/store/store';

export default function NewOpenChallenge() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <CreateOpenChallengeScreen />;
}
