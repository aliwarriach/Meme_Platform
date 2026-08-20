import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { WebConversationRow } from '@/components/web/WebConversationRow';
import WebInboxTopBar from '@/components/web/WebInboxTopBar';
import WebNewChatModal from '@/components/web/WebNewChatModal';
import { VaporwaveThemeProvider, useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useConversations } from '@/services/useMessaging';
import type { RootState } from '@/store/store';

/**
 * Web-only sibling of `features/messaging/InboxScreen.tsx` (native-resolved, byte-for-byte
 * untouched — Metro/Expo Router's platform-extension resolution prefers this file for the web
 * bundle at `app/inbox.tsx`, which needs zero changes). Full conversation-list page, reusing the
 * Vaporwave/Luminous glass design system already shipped on Feed/Friends/Voting/Challenges/
 * Leaderboard/Profile, via its own `VaporwaveThemeProvider` instance — same light/dark toggle
 * mechanism, persisted to the same `localStorage` key.
 *
 * Relationship to `components/web/DesktopInboxPanel.tsx` / `components/web/WebFeedRail.tsx`:
 * this is a different surface (a full standalone page, not a rail preview). Opening a thread from
 * either the sidebar "Inbox" link or `WebFeedRail`'s row preview on Feed both navigate to the same
 * `/inbox/[conversationId]` route, which now renders `ThreadScreen.web.tsx` instead of native's
 * `ThreadScreen.tsx` — so a thread opened from the Feed rail already deep-links into this same
 * migrated thread view with no extra wiring. See `pages/inbox-web.md` for the full relationship
 * record, including why `/inbox` was NOT rebuilt as a second two-pane rail (Feed's rail already
 * serves that always-visible-preview need).
 *
 * `DesktopShell` (mounted app-wide in `app/_layout.tsx`) already centers this screen in the
 * standard-width content column — no width handling needed here.
 */
export default function InboxScreen() {
  return (
    <VaporwaveThemeProvider>
      <InboxScreenContent />
    </VaporwaveThemeProvider>
  );
}

function InboxScreenContent() {
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const socketStatus = useSelector((state: RootState) => state.socket.status);
  const conversationsQuery = useConversations();
  const [newChatOpen, setNewChatOpen] = useState(false);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const conversations = conversationsQuery.data ?? [];

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebInboxTopBar socketStatus={socketStatus} onNewChat={() => setNewChatOpen(true)} />

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <WebConversationRow conversation={item} />}
          contentContainerStyle={styles.listContent}
          onRefresh={conversationsQuery.refetch}
          refreshing={conversationsQuery.isRefetching}
          ListEmptyComponent={
            conversationsQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : conversationsQuery.isError ? (
              <Text style={[type.body, styles.errorText]}>{conversationsQuery.error.message}</Text>
            ) : (
              <Text style={[type.body, styles.emptyText]}>
                No conversations yet — start one with a friend, or send them a meme from the feed.
              </Text>
            )
          }
        />
      </SafeAreaView>

      <WebNewChatModal visible={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </View>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    safe: {
      flex: 1,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    spinner: {
      marginTop: spacing.xxl,
    },
    errorText: {
      color: colors.error,
      padding: spacing.lg,
    },
    emptyText: {
      color: colors.foregroundMuted,
      padding: spacing.lg,
    },
  });
