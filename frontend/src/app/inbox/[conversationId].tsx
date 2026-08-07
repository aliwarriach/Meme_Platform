import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import ThreadScreen from '@/features/messaging/ThreadScreen';
import type { RootState } from '@/store/store';

export default function Conversation() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();

  if (!token) return <Redirect href="/login" />;
  if (!conversationId) return <Redirect href="/inbox" />;
  return <ThreadScreen conversationId={conversationId} />;
}
