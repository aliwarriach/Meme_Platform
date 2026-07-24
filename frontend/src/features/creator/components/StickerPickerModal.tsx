import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">
            Add a sticker
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sticker picker"
            onPress={onClose}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Text className="text-base font-semibold text-orange-500">Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="flex-row flex-wrap px-4 pb-8">
          {EMOJI_STICKERS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji} sticker`}
              onPress={() => onSelect(emoji)}
              className="m-1 h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900">
              <Text style={{ fontSize: 34 }}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
