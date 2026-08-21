import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import WebModalFrame from '@/components/web/WebModalFrame';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { MemeCard } from '@/features/feed/components/MemeCard';
import { ContainerCard } from '@/features/instagram-companion/ContainerCard';
import type { StandingContent } from '@/services/competitions';

interface CompetitionEntryModalProps {
  content: StandingContent | null;
  onClose: () => void;
}

/** Full-screen view of a competition entry, reusing the same interactive card the feed/Instagram-companion use. */
export function CompetitionEntryModal({ content, onClose }: CompetitionEntryModalProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  return (
    <Modal visible={!!content} animationType="slide" onRequestClose={onClose}>
      <WebModalFrame>
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View className="flex-row items-center justify-end px-4 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={24} color={c.inkMuted} />
          </Pressable>
        </View>
        <ScrollView>
          {content?.kind === 'meme' ? (
            <MemeCard meme={content.meme} />
          ) : content?.kind === 'container' ? (
            <ContainerCard container={content.container} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
      </WebModalFrame>
    </Modal>
  );
}
