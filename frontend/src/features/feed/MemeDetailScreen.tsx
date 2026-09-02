import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { MemeCard } from '@/features/feed/components/MemeCard';
import { useMeme } from '@/services/useMemes';

interface MemeDetailScreenProps {
  memeId: string;
}

/** Full single-post view — the profile grid's "tap to open" target (also reachable for any
 * meme id, matching the backend's own visibility check). Reuses `MemeCard` as-is (vote/comment/
 * send all work identically), just inside a plain `ScrollView` instead of the feed's FlatList. */
export default function MemeDetailScreen({ memeId }: MemeDetailScreenProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const memeQuery = useMeme(memeId);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Post" showBack />
      {memeQuery.isLoading ? (
        <ActivityIndicator className="mt-8" color={c.inkMuted} />
      ) : memeQuery.isError || !memeQuery.data ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-body text-sm text-error">
            {memeQuery.error?.message ?? 'This post is no longer available.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <MemeCard meme={memeQuery.data} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
