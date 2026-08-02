import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebModalFrame from '@/components/web/WebModalFrame';
import { EMOJI_STICKERS } from '@/features/creator/document';

interface StickerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

// Full-screen emoji picker. Bounded, curated set (see EMOJI_STICKERS), so a wrapped
// `.map` inside a ScrollView is appropriate — not a long/unbounded list.
export function StickerPickerModal({ visible, onClose, onSelect }: StickerPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <WebModalFrame>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="font-heading text-xl text-heading">Pick a Sticker</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sticker picker"
            onPress={onClose}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Text className="font-title text-base text-primary-dim">Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="flex-row flex-wrap px-4 pb-8">
          {EMOJI_STICKERS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji} sticker`}
              onPress={() => onSelect(emoji)}
              className="m-1 h-16 w-16 items-center justify-center rounded-2xl bg-surface-high">
              <Text style={{ fontSize: 34 }}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
      </WebModalFrame>
    </Modal>
  );
}
