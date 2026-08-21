import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useColorScheme } from 'nativewind';

import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { ConversationList, STATUS_DOT_COLOR } from '@/features/messaging/ConversationList';
import NewChatModal from '@/features/messaging/NewChatModal';
import type { RootState } from '@/store/store';

export default function InboxScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const socketStatus = useSelector((state: RootState) => state.socket.status);
  const [newChatOpen, setNewChatOpen] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Inbox"
        showBack
        rightActions={
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    STATUS_DOT_COLOR[socketStatus] ?? STATUS_DOT_COLOR.disconnected,
                }}
              />
              <Text className="font-body text-xs text-ink-muted">{socketStatus}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              onPress={() => setNewChatOpen(true)}
              className="h-11 w-11 items-center justify-center">
              <MaterialIcons name="edit" size={22} color={c.white} />
            </Pressable>
          </View>
        }
      />
      <ConversationList />
      <NewChatModal visible={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </SafeAreaView>
  );
}
