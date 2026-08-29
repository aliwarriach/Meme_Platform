import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import MessageBubble from '@/features/messaging/MessageBubble';
import type { MessageResponse } from '@/services/messaging';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationReadMutation,
  useSendMessageMutation,
} from '@/services/useMessaging';
import type { RootState } from '@/store/store';

const MAX_MESSAGE_LENGTH = 2000;

function Composer({ conversationId }: { conversationId: string }) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [draft, setDraft] = useState('');
  const sendMessage = useSendMessageMutation(conversationId);
  const trimmed = draft.trim();

  const onSend = () => {
    if (!trimmed) return;
    // Cleared immediately: the optimistic bubble is already in the thread, so leaving the
    // text in the box would show it twice.
    setDraft('');
    sendMessage.mutate({ kind: 'text', body: trimmed });
  };

  return (
    <View className="border-t border-outline-variant/30 bg-bg px-3 py-2">
      {sendMessage.isError ? (
        <Text className="px-1 pb-1 font-body text-xs text-error">
          {sendMessage.error.message}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={c.outline}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Message text"
          onSubmitEditing={onSend}
          className="max-h-28 min-h-[44px] flex-1 rounded-card bg-surface px-3 py-2 font-body text-ink"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={onSend}
          disabled={!trimmed}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary-container px-4 disabled:opacity-40">
          <Text className="font-title text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ThreadScreen({ conversationId }: { conversationId: string }) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const viewerId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: conversations } = useConversations();
  const conversation = conversations?.find((c) => c.id === conversationId);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationMessages(conversationId);
  const markRead = useMarkConversationReadMutation();

  // Marks read once per thread open. `markRead` is left out of the deps deliberately —
  // the mutation object's identity changes on every render, which would re-fire this.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (markedRef.current === conversationId) return;
    markedRef.current = conversationId;
    markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const messages: MessageResponse[] = data?.pages.flatMap((page) => page.items) ?? [];

  // Android-only: `KeyboardAvoidingView`'s automatic `'height'` mode is unreliable in this
  // exact tree (composer stays hidden behind the keyboard even with `windowSoftInputMode:
  // 'resize'` set — see app.config.js), so on Android this screen measures the keyboard
  // itself via `Keyboard.addListener` (the same event source `CommentsSection` already
  // uses successfully) and applies it as explicit bottom padding instead of trusting the
  // built-in heuristic. iOS's `'padding'` behavior isn't affected and is left untouched.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) =>
      setAndroidKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setAndroidKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title={conversation?.other_user.username ?? 'Conversation'}
        showBack
        titleAdornment={
          conversation ? (
            <Avatar
              username={conversation.other_user.username}
              avatarUrl={conversation.other_user.avatar_url}
              avatarPreset={conversation.other_user.avatar_preset}
              size="sm"
            />
          ) : null
        }
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={Platform.OS === 'android' ? { paddingBottom: androidKeyboardHeight } : undefined}>
        {isLoading ? (
          <ActivityIndicator className="mt-8" color={c.inkMuted} />
        ) : isError ? (
          <Text className="px-4 pt-4 font-body text-error">{error.message}</Text>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center font-body text-ink-muted">
              No messages yet. Say something.
            </Text>
          </View>
        ) : (
          <FlatList
            // Newest-first data rendered bottom-up, so the freshest message sits at the
            // bottom of the screen and older pages load as the user scrolls upward.
            inverted
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.sender.id === viewerId}
                isPending={item.id.startsWith('pending-')}
              />
            )}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              isFetchingNextPage ? <ActivityIndicator className="py-3" color={c.inkMuted} /> : null
            }
          />
        )}

        <Composer conversationId={conversationId} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
