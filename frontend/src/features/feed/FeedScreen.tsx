import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import TopBar from '@/components/TopBar';
import { MergedFeedList } from '@/features/feed/components/MemeFeedList';
import { ShareInstagramLinkModal } from '@/features/instagram-companion/ShareInstagramLinkModal';
import type { MergedFeedItem } from '@/services/memes';
import { useFeed } from '@/services/useMemes';

export default function FeedScreen() {
  const router = useRouter();
  const feedQuery = useFeed();
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const items: MergedFeedItem[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
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
              <MaterialIcons name="add-link" size={22} color="#ffffff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inbox"
              onPress={() => router.push('/inbox')}
              className="h-11 w-11 items-center justify-center">
              <MaterialIcons name="mail-outline" size={22} color="#ffffff" />
            </Pressable>
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
}
