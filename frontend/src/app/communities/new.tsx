import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import CreateCommunityScreen from '@/features/communities/CreateCommunityScreen';
import type { RootState } from '@/store/store';

export default function NewCommunity() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <CreateCommunityScreen />;
}
