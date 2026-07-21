import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import RegisterScreen from '@/features/auth/RegisterScreen';
import type { RootState } from '@/store/store';

export default function Register() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (token) return <Redirect href="/" />;
  return <RegisterScreen />;
}
