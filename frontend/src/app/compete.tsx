import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import CompeteScreen from '@/features/challenges/CompeteScreen';
import type { RootState } from '@/store/store';

export default function Compete() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <CompeteScreen />;
}
