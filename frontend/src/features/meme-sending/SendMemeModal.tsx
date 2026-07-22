import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';

import { useFriendsList } from '@/services/useFriends';
import { useSendMemeMutation } from '@/services/useMemeSending';

interface SendMemeModalProps {
  memeId: string;
  visible: boolean;
  onClose: () => void;
}

export function SendMemeModal({ memeId, visible, onClose }: SendMemeModalProps) {
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
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[70%] rounded-t-2xl bg-white p-4 dark:bg-neutral-900">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
              Send to a friend
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-neutral-500 dark:text-neutral-400">Close</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator />
          ) : !friends || friends.length === 0 ? (
            <Text className="py-4 text-neutral-500 dark:text-neutral-400">
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
                    className="min-h-[44px] flex-row items-center justify-between border-b border-neutral-100 py-3 disabled:opacity-50 dark:border-neutral-800">
                    <Text className="text-neutral-900 dark:text-white">{item.user.username}</Text>
                    {isSentToThis ? (
                      <Text className="text-orange-500">Sent</Text>
                    ) : (
                      <Text className="text-neutral-500 dark:text-neutral-400">Send</Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}

          {sendMeme.isError ? (
            <Text className="pt-2 text-xs text-red-500">{sendMeme.error?.message}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
