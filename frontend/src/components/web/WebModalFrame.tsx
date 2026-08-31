import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { KeyboardAvoidingScreen } from '@/components/KeyboardAvoidingScreen';
import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';

interface WebModalFrameProps {
  children: ReactNode;
}

/**
 * RN's `Modal` portals straight to `document.body` on web, escaping `DesktopShell`'s frame —
 * without this, full-screen picker/entry modals would render edge-to-edge across the whole
 * monitor. Centers modal content as a capped-width dialog on web; on native this is a no-op
 * passthrough for layout (same full-screen `Modal` as before) but still adds keyboard avoidance
 * — every native consumer (`TemplatePickerModal`, `ShareInstagramLinkModal`) renders straight
 * inside an RN `Modal`, which (like `BottomSheet`'s own `Modal`) needs its content to shift
 * above the keyboard on its own since the `Modal` itself doesn't shrink for it.
 */
export default function WebModalFrame({ children }: WebModalFrameProps) {
  if (Platform.OS !== 'web') return <KeyboardAvoidingScreen>{children}</KeyboardAvoidingScreen>;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Plum-black, not pure black — matches the Neon Plum canvas family instead of a generic
    // neutral scrim. Not mode-conditional: this frame has no theme awareness of its own and a
    // dim plum overlay reads correctly behind either light or dark modal content.
    backgroundColor: 'rgba(10, 5, 9, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: DESKTOP_MODAL_MAX_WIDTH,
    height: '90%',
    maxHeight: 800,
    borderRadius: 24,
    overflow: 'hidden',
  },
});
