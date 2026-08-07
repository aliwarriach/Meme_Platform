import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';

import TagFeedScreen from '@/features/hashtags/TagFeedScreen';
import type { RootState } from '@/store/store';

export default function Tag() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  if (!token) return <Redirect href="/login" />;
  return <TagFeedScreen slug={slug} />;
}
