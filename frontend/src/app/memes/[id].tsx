import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import MemeDetailScreen from '@/features/feed/MemeDetailScreen';
import type { RootState } from '@/store/store';

export default function MemeDetail() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!token) return <Redirect href="/login" />;
  return <MemeDetailScreen memeId={id} />;
}
