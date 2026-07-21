import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import CreatorScreen from '@/features/creator/CreatorScreen';
import type { RootState } from '@/store/store';

export default function NewPost() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <CreatorScreen />;
}
