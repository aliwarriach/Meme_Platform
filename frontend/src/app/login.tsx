import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import LoginScreen from '@/features/auth/LoginScreen';
import type { RootState } from '@/store/store';

export default function Login() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (token) return <Redirect href="/" />;
  return <LoginScreen />;
}
