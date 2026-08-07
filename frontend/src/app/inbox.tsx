import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import InboxScreen from '@/features/messaging/InboxScreen';
import type { RootState } from '@/store/store';

export default function Inbox() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <InboxScreen />;
}
