import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebFeedRail from '@/components/web/WebFeedRail';
import WebFeedTopBar from '@/components/web/WebFeedTopBar';
import { WebMergedFeedList } from '@/components/web/WebMergedFeedList';
import { FEED_WEB_COLORS, injectFeedWebFont } from '@/constants/webFeedTheme';
import { DESKTOP_FRAME_MIN_WIDTH } from '@/constants/webLayout';
import { ShareInstagramLinkModal } from '@/features/instagram-companion/ShareInstagramLinkModal';
import type { MergedFeedItem } from '@/services/memes';
import { useFeed } from '@/services/useMemes';

/**
 * Web-only sibling of `features/feed/FeedScreen.tsx` (native-resolved, byte-for-byte untouched —
 * Metro/Expo Router's platform-extension resolution prefers this file for every web bundle,
 * `app/feed.tsx` needs zero changes). GREENFIELD-mode pilot for a new "Dark Cinema" visual
 * identity, page-scoped to `design-system/meme-platform/pages/feed-web.md` — see that file and
 * the agent's final report for the skill-query convergence behind every token used here.
 *
 * Layout: this renders INSIDE `DesktopShell`'s content column (mounted once, app-wide, in
 * `app/_layout.tsx` — out of bounds for this pass). At >= DESKTOP_FRAME_MIN_WIDTH, `DesktopShell`
 * already supplies the persistent left sidebar nav; this screen adds its own right-hand inbox
 * rail (Concept C — "Cinematic Column + Live Rail", see report) to use the wider feed-route
 * column productively without touching the primary scroll/vote interaction model. Below that
 * width (mobile browser / narrow window), `DesktopShell` is a no-op passthrough, so this screen
 * falls back to a full-bleed single column with `FloatingBottomNav` for navigation (that
 * component already self-hides at >= DESKTOP_FRAME_MIN_WIDTH, so no duplicate-nav branching is
 * needed here).
 */
export default function FeedScreen() {
  const feedQuery = useFeed();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const showRail = width >= DESKTOP_FRAME_MIN_WIDTH;

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const items: MergedFeedItem[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[FEED_WEB_COLORS.gradientTop, FEED_WEB_COLORS.gradientMid, FEED_WEB_COLORS.gradientBottom]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.body}>
          <View style={styles.column}>
            <WebFeedTopBar onShareInstagramLink={() => setShareModalVisible(true)} />

            <View style={styles.listWrap}>
              <WebMergedFeedList
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
          </View>

          {showRail ? <WebFeedRail /> : null}
        </View>
      </SafeAreaView>

      <FloatingBottomNav active="feed" />

      <ShareInstagramLinkModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  listWrap: {
    flex: 1,
  },
});
