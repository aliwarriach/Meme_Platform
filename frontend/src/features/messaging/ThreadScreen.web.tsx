import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import WebMessageBubble from '@/components/web/WebMessageBubble';
import WebMessageComposer from '@/components/web/WebMessageComposer';
import WebThreadTopBar from '@/components/web/WebThreadTopBar';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import type { MessageResponse } from '@/services/messaging';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationReadMutation,
} from '@/services/useMessaging';
import type { RootState } from '@/store/store';

/**
 * Web-only sibling of `features/messaging/ThreadScreen.tsx` (native-resolved, byte-for-byte
 * untouched — `app/inbox/[conversationId].tsx` imports `ThreadScreen` by specifier, and Metro's
 * platform-extension resolution now prefers this file for the web bundle, no route file change
 * needed). Reached from either `/inbox`'s own conversation list or `WebFeedRail`'s always-open
 * rail preview on Feed — both navigate here via the same `router.push('/inbox/[conversationId]')`
 * call already in `services/useMessaging.ts`/`WebConversationRow`/`WebNewChatModal`.
 *
 * Same optimistic/socket-patched cache model as native — `useConversationMessages`,
 * `useSendMessageMutation` (inside `WebMessageComposer`), and `useMarkConversationReadMutation`
 * are the same query hooks, unmodified; this file only changes presentation, never the cache
 * transforms in `services/messagingCache.ts` (per `frontend/CLAUDE.md`: incoming socket frames
 * patch the cache, never invalidate it — this screen doesn't add any refetch that would break
 * that).
 */
export default function ThreadScreen({ conversationId }: { conversationId: string }) {
  return (
      <ThreadScreenContent conversationId={conversationId} />
  );
}

function ThreadScreenContent({ conversationId }: { conversationId: string }) {
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const viewerId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: conversations } = useConversations();
  const conversation = conversations?.find((c) => c.id === conversationId);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationMessages(conversationId);
  const markRead = useMarkConversationReadMutation();

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  // Marks read once per thread open — identical guard to native's ThreadScreen. `markRead` is
  // deliberately left out of the deps (its identity changes every render, which would re-fire this).
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (markedRef.current === conversationId) return;
    markedRef.current = conversationId;
    markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const messages: MessageResponse[] = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebThreadTopBar
          username={conversation?.other_user.username ?? 'Conversation'}
          avatarUrl={conversation?.other_user.avatar_url}
        />

        <View style={styles.body}>
          {isLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
          ) : isError ? (
            <Text style={[type.body, styles.errorText]}>{error.message}</Text>
          ) : messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[type.body, styles.emptyText]}>No messages yet. Say something.</Text>
            </View>
          ) : (
            <FlatList
              // Newest-first data rendered bottom-up, same inverted convention as native, so the
              // freshest message sits at the bottom and older pages load scrolling upward.
              inverted
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <WebMessageBubble
                  message={item}
                  isOwn={item.sender.id === viewerId}
                  isPending={item.id.startsWith('pending-')}
                />
              )}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={
                isFetchingNextPage ? <ActivityIndicator style={styles.footerSpinner} color={colors.foregroundMuted} /> : null
              }
            />
          )}
        </View>

        <WebMessageComposer conversationId={conversationId} />
      </SafeAreaView>
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
    body: {
      flex: 1,
    },
    listContent: {
      paddingVertical: spacing.sm,
    },
    spinner: {
      marginTop: spacing.xxl,
    },
    footerSpinner: {
      paddingVertical: spacing.md,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    emptyText: {
      color: colors.foregroundMuted,
      textAlign: 'center',
    },
    errorText: {
      color: colors.error,
      padding: spacing.lg,
    },
  });
