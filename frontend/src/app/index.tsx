import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import SessionScreen from '@/features/auth/SessionScreen';
import type { RootState } from '@/store/store';

export default function Index() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <SessionScreen />;
}
