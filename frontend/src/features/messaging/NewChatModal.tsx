import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useFriendsList } from '@/services/useFriends';
import { useOpenConversationMutation } from '@/services/useMessaging';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Same "Send to" chrome as `SendMemeModal` (solid, mode-aware background — no dark-tinted
 * `BlurView`) and the same searchable friend list, but single-select: tapping a name/card opens
 * that conversation immediately rather than collecting a multi-select batch to send to. */
export default function NewChatModal({ visible, onClose }: NewChatModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const { data: friends, isLoading } = useFriendsList();
  const openConversation = useOpenConversationMutation();
  const [query, setQuery] = useState('');

  const filteredFriends = useMemo(() => {
    const list = friends ?? [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((f) => f.user.username.toLowerCase().includes(needle));
  }, [friends, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const onPick = (userId: string) => {
    openConversation.mutate(userId, {
      onSuccess: (conversation) => {
        handleClose();
        router.push({
          pathname: '/inbox/[conversationId]',
          params: { conversationId: conversation.id },
        });
      },
    });
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={70}>
      <View className="border-t border-outline-variant/30 bg-bg">
        <View className="flex-row items-center justify-between p-4 pb-3">
          <Text className="font-heading text-lg text-heading">New Chat</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2">
          <MaterialIcons name="search" size={18} color={c.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends"
            placeholderTextColor={c.outline}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-1 font-body text-base text-heading"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator className="py-6" color={c.inkMuted} />
        ) : !friends || friends.length === 0 ? (
          <Text className="px-4 py-6 font-body text-ink-muted">
            Add a friend first — you can only message accepted friends.
          </Text>
        ) : filteredFriends.length === 0 ? (
          <Text className="px-4 py-6 font-body text-ink-muted">No friends match &quot;{query}&quot;.</Text>
        ) : (
          <FlatList
            style={{ flexGrow: 0, flexShrink: 1 }}
            data={filteredFriends}
            keyExtractor={(item) => item.friendship_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message ${item.user.username}`}
                onPress={() => onPick(item.user.id)}
                disabled={openConversation.isPending}
                className="min-h-[44px] flex-row items-center gap-3 rounded-card px-3 py-2 disabled:opacity-50">
                <Avatar
                  username={item.user.username}
                  avatarUrl={item.user.avatar_url}
                  avatarPreset={item.user.avatar_preset}
                  size="md"
                />
                <Text className="font-body text-heading">{item.user.username}</Text>
              </Pressable>
            )}
          />
        )}

        {openConversation.isError ? (
          <Text className="px-4 pb-2 font-body text-xs text-error">
            {openConversation.error.message}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
