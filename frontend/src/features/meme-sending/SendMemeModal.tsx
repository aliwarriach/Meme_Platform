import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';
import { useFriendsList } from '@/services/useFriends';
import { useSendMemeMutation } from '@/services/useMemeSending';

interface SendMemeModalProps {
  memeId: string;
  visible: boolean;
  onClose: () => void;
}

export function SendMemeModal({ memeId, visible, onClose }: SendMemeModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const { data: friends, isLoading } = useFriendsList();
  const sendMeme = useSendMemeMutation();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSend = (recipientId: string) => {
    sendMeme.mutate(
      { recipientId, memeId },
      { onSuccess: () => setSentTo(recipientId) }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View
        className="flex-1 justify-end bg-black/60"
        style={Platform.OS === 'web' ? { alignItems: 'center' } : undefined}>
        <View
          className="max-h-[70%] overflow-hidden rounded-t-card"
          style={Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MODAL_MAX_WIDTH } : undefined}>
          <BlurView intensity={60} tint="dark" className="border-t border-outline-variant/40 bg-surface/85 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-heading text-lg text-heading">Send to a Friend</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                className="h-11 w-11 items-center justify-center">
                <Text className="font-body text-ink-muted">Close</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator color={c.inkMuted} />
            ) : !friends || friends.length === 0 ? (
              <Text className="py-4 font-body text-ink-muted">
                Add a friend first to send memes directly.
              </Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.friendship_id}
                renderItem={({ item }) => {
                  const isSentToThis = sentTo === item.user.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Send meme to ${item.user.username}`}
                      onPress={() => onSend(item.user.id)}
                      disabled={sendMeme.isPending || isSentToThis}
                      className="min-h-[44px] flex-row items-center justify-between border-b border-outline-variant/30 py-3 disabled:opacity-50">
                      <View className="flex-row items-center gap-3">
                        <Avatar username={item.user.username} size="sm" />
                        <Text className="font-body text-heading">{item.user.username}</Text>
                      </View>
                      {isSentToThis ? (
                        <Text className="font-title text-primary">Sent</Text>
                      ) : (
                        <Text className="font-body text-ink-muted">Send</Text>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}

            {sendMeme.isError ? (
              <Text className="pt-2 font-body text-xs text-error">{sendMeme.error?.message}</Text>
            ) : null}
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}
