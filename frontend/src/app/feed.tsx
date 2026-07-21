import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import FeedScreen from '@/features/feed/FeedScreen';
import type { RootState } from '@/store/store';

export default function Feed() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <FeedScreen />;
}
