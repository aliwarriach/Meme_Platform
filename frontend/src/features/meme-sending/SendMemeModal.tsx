import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import PillButton from '@/components/PillButton';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useFriendsList } from '@/services/useFriends';
import { useSendMemeMutation } from '@/services/useMemeSending';

interface SendMemeModalProps {
  memeId: string;
  visible: boolean;
  onClose: () => void;
}

/** Instagram-style "Send to" sheet: search, multi-select recipients (a row of selected-avatar
 * chips confirms the picks), one "Send" action fires the meme to everyone selected. The backend
 * only sends to one recipient per call, so a multi-select send is N calls fired together — there's
 * no group-thread concept in this app's messaging (friend-to-friend only, see CLAUDE.md), so
 * "send to a group" here means "send to several friends at once," not a single group message. */
export function SendMemeModal({ memeId, visible, onClose }: SendMemeModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const { data: friends, isLoading } = useFriendsList();
  const sendMeme = useSendMemeMutation();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedById = useMemo(() => new Map((friends ?? []).map((f) => [f.user.id, f])), [friends]);

  const filteredFriends = useMemo(() => {
    const list = friends ?? [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((f) => f.user.username.toLowerCase().includes(needle));
  }, [friends, query]);

  const reset = () => {
    setQuery('');
    setSelectedIds([]);
    setSentIds([]);
    setSendError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleSelected = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const onSend = async () => {
    setIsSending(true);
    setSendError(null);
    try {
      await Promise.all(
        selectedIds.map((recipientId) => sendMeme.mutateAsync({ recipientId, memeId }))
      );
      setSentIds(selectedIds);
      setSelectedIds([]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send to everyone selected.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={80}>
      <View className="border-t border-outline-variant/30 bg-bg">
        <View className="flex-row items-center justify-between p-4 pb-3">
          <Text className="font-heading text-lg text-heading">Send to</Text>
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

        {selectedIds.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={selectedIds}
            keyExtractor={(id) => id}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}
            renderItem={({ item: userId }) => {
              const friend = selectedById.get(userId);
              if (!friend) return null;
              return (
                <View className="items-center" style={{ width: 56 }}>
                  <View>
                    <Avatar
                      username={friend.user.username}
                      avatarUrl={friend.user.avatar_url}
                      avatarPreset={friend.user.avatar_preset}
                      size="md"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${friend.user.username}`}
                      onPress={() => toggleSelected(userId)}
                      className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-surface-high">
                      <MaterialIcons name="close" size={12} color={c.inkMuted} />
                    </Pressable>
                  </View>
                  <Text numberOfLines={1} className="mt-1 font-body text-xs text-ink-muted">
                    {friend.user.username}
                  </Text>
                </View>
              );
            }}
          />
        ) : null}

        {isLoading ? (
          <ActivityIndicator className="py-6" color={c.inkMuted} />
        ) : !friends || friends.length === 0 ? (
          <Text className="px-4 py-6 font-body text-ink-muted">
            Add a friend first to send memes directly.
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
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.user.id);
              const isSent = sentIds.includes(item.user.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isSent
                      ? `Already sent to ${item.user.username}`
                      : `${isSelected ? 'Deselect' : 'Select'} ${item.user.username}`
                  }
                  accessibilityState={{ selected: isSelected, disabled: isSent }}
                  onPress={() => !isSent && toggleSelected(item.user.id)}
                  disabled={isSent}
                  className="min-h-[44px] flex-row items-center justify-between rounded-card px-3 py-2 disabled:opacity-50">
                  <View className="flex-row items-center gap-3">
                    <Avatar
                      username={item.user.username}
                      avatarUrl={item.user.avatar_url}
                      avatarPreset={item.user.avatar_preset}
                      size="md"
                    />
                    <Text className="font-body text-heading">{item.user.username}</Text>
                  </View>
                  {isSent ? (
                    <Text className="font-title text-primary">Sent</Text>
                  ) : (
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                        isSelected ? 'border-primary bg-primary' : 'border-outline-variant'
                      }`}>
                      {isSelected ? <MaterialIcons name="check" size={16} color={c.white} /> : null}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        {sendError ? (
          <Text className="px-4 pb-2 font-body text-xs text-error">{sendError}</Text>
        ) : null}

        <View className="p-4 pt-2">
          <PillButton
            label={
              isSending
                ? 'Sending…'
                : selectedIds.length > 0
                  ? `Send to ${selectedIds.length}`
                  : 'Send'
            }
            onPress={onSend}
            loading={isSending}
            disabled={selectedIds.length === 0}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
