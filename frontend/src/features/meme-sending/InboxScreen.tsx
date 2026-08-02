import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import TopBar from '@/components/TopBar';
import { InboxList, STATUS_DOT_COLOR } from '@/features/meme-sending/InboxList';
import type { RootState } from '@/store/store';

export default function InboxScreen() {
  const socketStatus = useSelector((state: RootState) => state.socket.status);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar
        title="Inbox"
        showBack
        rightActions={
          <View className="flex-row items-center gap-1.5">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_DOT_COLOR[socketStatus] ?? STATUS_DOT_COLOR.disconnected }}
            />
            <Text className="font-body text-xs text-ink-muted">{socketStatus}</Text>
          </View>
        }
      />
      <InboxList />
    </SafeAreaView>
  );
}
