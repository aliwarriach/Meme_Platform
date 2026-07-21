import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import CommunitiesScreen from '@/features/communities/CommunitiesScreen';
import type { RootState } from '@/store/store';

export default function Communities() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <CommunitiesScreen />;
}
