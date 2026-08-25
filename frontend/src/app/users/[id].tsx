import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import ProfileScreen from '@/features/profile/ProfileScreen';
import type { RootState } from '@/store/store';

export default function UserProfile() {
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!token) return <Redirect href="/login" />;
  // Navigating to your own id (e.g. tapping your own name somewhere) shows the regular
  // profile chrome (settings, bottom nav) rather than the friend-viewing one.
  return <ProfileScreen userId={id} isOwnProfile={!!user && id === user.id} />;
}
