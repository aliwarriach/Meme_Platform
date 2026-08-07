import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import NotificationsScreen from '@/features/notifications/NotificationsScreen';
import type { RootState } from '@/store/store';

export default function Notifications() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <NotificationsScreen />;
}
