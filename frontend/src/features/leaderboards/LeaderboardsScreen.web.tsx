import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebLeaderboardsPanel } from '@/components/web/WebLeaderboardsPanel';
import WebLeaderboardsTopBar from '@/components/web/WebLeaderboardsTopBar';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

/**
 * Web-only sibling of `features/leaderboards/LeaderboardsScreen.tsx` (native-resolved, byte-for-
 * byte untouched — Expo Router's platform-extension resolution prefers this file for the web
 * bundle, `app/leaderboards.tsx` needs zero changes). Just the page chrome (top bar) around
 * `WebLeaderboardsPanel`, which carries the actual tabs/list/rows — that panel is shared with
 * `CompeteScreen.web.tsx`'s own Leaderboards tab, same relationship native's `LeaderboardsPanel`
 * has to native's own Compete screen.
 */
function LeaderboardsScreenContent() {
  const { colors } = useVaporwaveTheme();

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebLeaderboardsTopBar title="Leaderboards" />
        <WebLeaderboardsPanel />
      </SafeAreaView>
    </View>
  );
}

export default function LeaderboardsScreen() {
  return <LeaderboardsScreenContent />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
});
