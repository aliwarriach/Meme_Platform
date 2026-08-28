import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import ForgotPasswordScreen from '@/features/auth/ForgotPasswordScreen';
import type { RootState } from '@/store/store';

export default function ForgotPassword() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (token) return <Redirect href="/" />;
  return <ForgotPasswordScreen />;
}
