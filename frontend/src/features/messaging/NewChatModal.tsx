import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';
import { useFriendsList } from '@/services/useFriends';
import { useOpenConversationMutation } from '@/services/useMessaging';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NewChatModal({ visible, onClose }: NewChatModalProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const { data: friends, isLoading } = useFriendsList();
  const openConversation = useOpenConversationMutation();

  const onPick = (userId: string) => {
    openConversation.mutate(userId, {
      onSuccess: (conversation) => {
        onClose();
        router.push({
          pathname: '/inbox/[conversationId]',
          params: { conversationId: conversation.id },
        });
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View
        className="flex-1 justify-end bg-black/60"
        style={Platform.OS === 'web' ? { alignItems: 'center' } : undefined}>
        <View
          className="max-h-[70%] overflow-hidden rounded-t-card"
          style={
            Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MODAL_MAX_WIDTH } : undefined
          }>
          <BlurView
            intensity={60}
            tint="dark"
            className="border-t border-outline-variant/40 bg-surface/85 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-heading text-lg text-heading">New Chat</Text>
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
                Add a friend first — you can only message accepted friends.
              </Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.friendship_id}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${item.user.username}`}
                    onPress={() => onPick(item.user.id)}
                    disabled={openConversation.isPending}
                    className="min-h-[44px] flex-row items-center gap-3 border-b border-outline-variant/30 py-3 disabled:opacity-50">
                    <Avatar username={item.user.username} size="sm" />
                    <Text className="font-body text-heading">{item.user.username}</Text>
                  </Pressable>
                )}
              />
            )}

            {openConversation.isError ? (
              <Text className="pt-2 font-body text-xs text-error">
                {openConversation.error.message}
              </Text>
            ) : null}
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}
