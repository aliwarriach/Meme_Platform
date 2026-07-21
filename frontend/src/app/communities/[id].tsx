import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import CommunityDetailScreen from '@/features/communities/CommunityDetailScreen';
import type { RootState } from '@/store/store';

export default function CommunityDetail() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!token) return <Redirect href="/login" />;
  return <CommunityDetailScreen communityId={id} />;
}
