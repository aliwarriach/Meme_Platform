import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import FriendsScreen from '@/features/friends/FriendsScreen';
import type { RootState } from '@/store/store';

export default function Friends() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <FriendsScreen />;
}
