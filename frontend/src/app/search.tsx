import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

import SearchScreen from '@/features/search/SearchScreen';
import type { RootState } from '@/store/store';

export default function Search() {
  const token = useSelector((state: RootState) => state.auth.token);
  if (!token) return <Redirect href="/login" />;
  return <SearchScreen />;
}
