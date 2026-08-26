import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Cap on the sheet's height, as a percentage of the screen. Defaults to 80. */
  maxHeightPercent?: number;
}

// Drag past this far, or fling fast enough, and the sheet finishes closing instead of
// springing back — matches the native iOS/Android sheet-dismiss feel.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

/**
 * Shared bottom-sheet chrome for every "Modal" in the app that slides up from the bottom
 * (Send to, New Chat, edit sheets, duel proposals, ...): the backdrop + sheet container +
 * a drag handle, with swipe-down-to-dismiss wired to the handle strip specifically — not the
 * whole sheet body, so it never fights a `FlatList`/`ScrollView` living inside a modal's own
 * content. Each modal keeps its own header/content; this only owns the outer shell.
 */
export function BottomSheet({ visible, onClose, children, maxHeightPercent = 80 }: BottomSheetProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(800, { duration: 180 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* react-native-gesture-handler requires its own GestureHandlerRootView around any
          content that lives inside a React Native `Modal` — a Modal renders to a separate
          native window/root that the app-wide GestureHandlerRootView in app/_layout.tsx
          does not extend into, so the swipe-down gesture below would silently fail to
          register without this. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          className="flex-1 justify-end bg-black/60"
          style={Platform.OS === 'web' ? { alignItems: 'center' } : undefined}>
          <Animated.View
            style={[
              { maxHeight: `${maxHeightPercent}%` },
              Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MODAL_MAX_WIDTH } : undefined,
              animatedStyle,
            ]}
            className="overflow-hidden rounded-t-card bg-bg">
            <GestureDetector gesture={pan}>
              <View accessibilityLabel="Drag down to close" className="items-center py-3">
                {/* `outline-variant` (used elsewhere for hairline dividers) is a ~10%-opacity
                    wash — nearly invisible for something meant to read as a grabbable handle.
                    `outline` is the same hue at full, solid opacity. */}
                <View className="h-1.5 w-12 rounded-full bg-outline" />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
