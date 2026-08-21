import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import WebModalFrame from '@/components/web/WebModalFrame';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { EMOJI_STICKERS } from '@/features/creator/document';

interface WebStickerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/** Themed replacement for `features/creator/components/StickerPickerModal.tsx`. Bounded,
 * curated emoji set (see `EMOJI_STICKERS`), so a wrapped `.map` inside a `ScrollView` is
 * appropriate here too — same reasoning as the native file's own comment. */
export function WebStickerPickerModal({ visible, onClose, onSelect }: WebStickerPickerModalProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      <WebModalFrame>
        <View style={[styles.root, { backgroundColor: colors.surfaceSolid }]}>
          <View style={styles.header}>
            <Text style={[type.h2, { color: colors.foreground }]}>Pick a Sticker</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sticker picker"
              onPress={onClose}
              style={({ hovered, focused }: WebPressableState) => [
                styles.doneButton,
                hovered && { backgroundColor: colors.surfaceHover },
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
              ]}>
              <Text style={[type.title, { color: colors.indigoPrimary }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.grid}>
            {EMOJI_STICKERS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Add ${emoji} sticker`}
                onPress={() => onSelect(emoji)}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.cell,
                  { backgroundColor: colors.surfaceElevated },
                  hovered && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </WebModalFrame>
    </Modal>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    doneButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    cell: {
      height: 64,
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.chip,
    },
    emoji: {
      fontSize: 34,
    },
  });
