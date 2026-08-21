import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import NotificationBell from '@/components/NotificationBell';
import TopBar from '@/components/TopBar';
import DesktopInboxPanel from '@/components/web/DesktopInboxPanel';
import { DESKTOP_FRAME_MIN_WIDTH } from '@/constants/webLayout';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { MergedFeedList } from '@/features/feed/components/MemeFeedList';
import { ShareInstagramLinkModal } from '@/features/instagram-companion/ShareInstagramLinkModal';
import type { MergedFeedItem } from '@/services/memes';
import { useFeed } from '@/services/useMemes';

export default function FeedScreen() {
  const router = useRouter();
  const feedQuery = useFeed();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const showDesktopInbox = Platform.OS === 'web' && width >= DESKTOP_FRAME_MIN_WIDTH;
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  const items: MergedFeedItem[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const feedPane = (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="MemeVerse"
        rightActions={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share an Instagram Reel"
              onPress={() => setShareModalVisible(true)}
              className="h-11 w-11 items-center justify-center">
              <MaterialIcons name="add-link" size={22} color={c.heading} />
            </Pressable>
            <NotificationBell />
            {showDesktopInbox ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Inbox"
                onPress={() => router.push('/inbox')}
                className="h-11 w-11 items-center justify-center">
                <MaterialIcons name="mail-outline" size={22} color={c.heading} />
              </Pressable>
            )}
          </>
        }
      />

      <View className="flex-1">
        <MergedFeedList
          items={items}
          isLoading={feedQuery.isLoading}
          isError={feedQuery.isError}
          errorMessage={feedQuery.error?.message}
          hasNextPage={feedQuery.hasNextPage}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          onEndReached={() => feedQuery.fetchNextPage()}
          isRefetching={feedQuery.isRefetching}
          onRefresh={() => feedQuery.refetch()}
          emptyMessage="No memes yet — be the first to post"
        />
      </View>

      <FloatingBottomNav active="feed" />

      <ShareInstagramLinkModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
      />
    </SafeAreaView>
  );

  if (!showDesktopInbox) return feedPane;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>{feedPane}</View>
      <DesktopInboxPanel />
    </View>
  );
}
