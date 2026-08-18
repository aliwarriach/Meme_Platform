import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebPillButton from '@/components/web/WebPillButton';
import { WebCommunityCard } from '@/components/web/WebCommunityCard';
import WebCommunityTopBar from '@/components/web/WebCommunityTopBar';
import { WebSegmentedControl } from '@/components/web/WebSegmentedControl';
import { CommunityThemeProvider, useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, injectCommunityWebFont, type WebPressableState } from '@/constants/webCommunityTheme';
import type { CommunityResponse } from '@/services/communities';
import { useDiscoverCommunities, useMyCommunities } from '@/services/useCommunities';

type Tab = 'mine' | 'discover';

/**
 * Web-only sibling of `features/communities/CommunitiesScreen.tsx` (native-resolved, untouched —
 * Expo Router's platform-extension resolution prefers this file for every web bundle,
 * `app/communities.tsx` needs zero changes). GREENFIELD-mode pilot for a new "Vibrant &
 * Block-based" light+dark visual identity, page-scoped to
 * `design-system/meme-platform/pages/community-web.md`.
 *
 * Layout: renders inside `DesktopShell`'s content column (mounted app-wide in `app/_layout.tsx`,
 * out of bounds for this pass). Discover/My Communities render as a 2-column card grid (Concept A
 * from the agent's report) rather than the native single-column list, to make better use of the
 * desktop column width for a browse/scan task.
 */
function CommunitiesScreenContent() {
  const router = useRouter();
  const { colors } = useCommunityWebTheme();
  const [tab, setTab] = useState<Tab>('mine');

  const mineQuery = useMyCommunities();
  const discoverQuery = useDiscoverCommunities();

  useEffect(() => {
    injectCommunityWebFont();
  }, []);

  const discoverCommunities: CommunityResponse[] = discoverQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const mineCommunities = mineQuery.data ?? [];
  const activeList = tab === 'mine' ? mineCommunities : discoverCommunities;
  const activeQuery = tab === 'mine' ? mineQuery : discoverQuery;

  const goToCommunity = (id: string) => router.push({ pathname: '/communities/[id]', params: { id } });

  const onScrollEnd = ({ nativeEvent }: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
    if (nearBottom && tab === 'discover' && discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
      discoverQuery.fetchNextPage();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <WebCommunityTopBar
        title="Communities"
        rightActions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a community"
            onPress={() => router.push('/communities/new')}
            style={({ hovered, focused }: WebPressableState) => [
              styles.createIconButton,
              { backgroundColor: colors.primary },
              hovered && { opacity: 0.9 },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <MaterialIcons name="add" size={20} color={colors.onPrimary} />
          </Pressable>
        }
      />

      <ScrollView style={styles.scroll} onScroll={onScrollEnd} scrollEventThrottle={200} contentContainerStyle={styles.content}>
        <WebSegmentedControl
          options={[
            { key: 'mine', label: 'My Communities' },
            { key: 'discover', label: 'Discover' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <View style={styles.grid}>
          {activeList.map((community) => (
            <WebCommunityCard key={community.id} community={community} onPress={() => goToCommunity(community.id)} />
          ))}
        </View>

        {activeQuery.isLoading ? (
          <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
        ) : activeQuery.isError ? (
          <Text style={[COMMUNITY_WEB_TYPE.body, { color: colors.destructive }]}>{activeQuery.error?.message}</Text>
        ) : activeList.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[COMMUNITY_WEB_TYPE.body, styles.emptyText, { color: colors.foregroundMuted }]}>
              {tab === 'mine' ? "You haven't joined any communities yet" : 'No communities yet — be the first to create one'}
            </Text>
            {tab === 'mine' ? (
              <WebPillButton label="Discover Communities" variant="outline" onPress={() => setTab('discover')} />
            ) : null}
          </View>
        ) : null}

        {tab === 'discover' && discoverQuery.isFetchingNextPage ? (
          <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
        ) : null}
      </ScrollView>

      <FloatingBottomNav active="communities" />
    </View>
  );
}

export default function CommunitiesScreen() {
  return (
    <CommunityThemeProvider>
      <CommunitiesScreenContent />
    </CommunityThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: COMMUNITY_WEB_SPACING.xl,
    paddingBottom: 100,
    gap: COMMUNITY_WEB_SPACING.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COMMUNITY_WEB_SPACING.lg,
  },
  createIconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  spinner: {
    marginVertical: COMMUNITY_WEB_SPACING.xl,
  },
  empty: {
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
    paddingVertical: COMMUNITY_WEB_SPACING.xxl,
  },
  emptyText: {
    textAlign: 'center',
  },
});
