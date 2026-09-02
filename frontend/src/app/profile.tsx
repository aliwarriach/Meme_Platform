import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import ProfileScreen from '@/features/profile/ProfileScreen';
import type { RootState } from '@/store/store';

export default function Profile() {
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  if (!token) return <Redirect href="/login" />;
  if (!user) return null;
  return <ProfileScreen userId={user.id} isOwnProfile />;
}
