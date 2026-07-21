import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import LeaderboardsScreen from '@/features/leaderboards/LeaderboardsScreen';
import type { RootState } from '@/store/store';

export default function Leaderboards() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <LeaderboardsScreen />;
}
