import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import VotingScreen from '@/features/voting/VotingScreen';
import type { RootState } from '@/store/store';

export default function Voting() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <VotingScreen />;
}
