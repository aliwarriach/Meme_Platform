import { useEffect, type ReactNode } from 'react';
import {
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { KeyboardAvoidingScreen } from '@/components/KeyboardAvoidingScreen';
import { DESKTOP_MODAL_MAX_WIDTH } from '@/constants/webLayout';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Resting height, as a percentage of the screen. Defaults to 80. */
  maxHeightPercent?: number;
}

// Fling fast enough, or end the drag more than halfway toward a given snap point, and the
// sheet finishes the transition instead of springing back — matches native sheet feel.
const DISMISS_VELOCITY = 800;
const EXPAND_VELOCITY = -800;
const CLOSE_DURATION = 180;

/**
 * Shared bottom-sheet chrome for every "Modal" in the app that slides up from the bottom
 * (Send to, New Chat, edit sheets, duel proposals, ...): the backdrop + sheet container + a
 * drag handle. The handle supports three gestures, Instagram-comments-style: drag down to
 * close, drag up to expand to (near-)fullscreen, or tap the backdrop to close. Wired to the
 * handle strip specifically — not the whole sheet body — so it never fights a
 * `FlatList`/`ScrollView` living inside a modal's own content. Each modal keeps its own
 * header/content; this only owns the outer shell.
 *
 * Implementation note: a single shared value (`revealedHeight`, in pixels) drives the sheet's
 * actual `height` style, animating between three points — `0` (closed), `restHeight` (the
 * default, `maxHeightPercent`-based resting height) and `expandedHeight` (near-fullscreen,
 * leaving a small gap at the top). The sheet is bottom-anchored (`justify-content: 'flex-end'`
 * on its container) so growing/shrinking this one value naturally reads as the sheet's *top*
 * edge rising for an upward drag or falling for a downward one, with the bottom edge staying
 * put — exactly the Reels-comments motion — without needing a separate translateY animation
 * for the close case.
 */
export function BottomSheet({ visible, onClose, children, maxHeightPercent = 80 }: BottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const restHeight = (screenHeight * maxHeightPercent) / 100;
  const expandedHeight = screenHeight - insets.top - 16;

  const revealedHeight = useSharedValue(restHeight);
  const dragStartHeight = useSharedValue(restHeight);

  useEffect(() => {
    if (visible) revealedHeight.value = restHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Android hardware back button: dismiss the keyboard first if it's up (matches every other
  // Android surface — comments, chat, ...), only closing the sheet itself on a second press.
  // Returning `false` when the keyboard is already down lets the event fall through to the
  // `Modal`'s own `onRequestClose` below, which is what actually closes the sheet.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [visible]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartHeight.value = revealedHeight.value;
    })
    .onUpdate((event) => {
      // Dragging the finger down should shrink the sheet; dragging up should grow it.
      const next = dragStartHeight.value - event.translationY;
      // react-hooks/immutability doesn't understand Reanimated's SharedValue.value setter —
      // mutating .value from a worklet is the documented, correct API, not a bug.
      // eslint-disable-next-line react-hooks/immutability
      revealedHeight.value = Math.max(0, Math.min(expandedHeight, next));
    })
    .onEnd((event) => {
      const current = revealedHeight.value;
      const distanceToClosed = current;
      const distanceToRest = Math.abs(current - restHeight);
      const distanceToExpanded = Math.abs(current - expandedHeight);

      let target: number;
      if (event.velocityY > DISMISS_VELOCITY) {
        target = 0;
      } else if (event.velocityY < EXPAND_VELOCITY) {
        target = expandedHeight;
      } else if (distanceToClosed <= distanceToRest && distanceToClosed <= distanceToExpanded) {
        target = 0;
      } else if (distanceToExpanded <= distanceToRest) {
        target = expandedHeight;
      } else {
        target = restHeight;
      }

      if (target === 0) {
        // eslint-disable-next-line react-hooks/immutability -- see note above
        revealedHeight.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) {
            // Reset immediately (while hidden) rather than waiting for `visible` to flip back
            // to true next open — otherwise the sheet briefly renders collapsed-to-zero before
            // the `useEffect` above catches up, which read as "the modal takes a second to
            // actually open."
            revealedHeight.value = restHeight;
            runOnJS(close)();
          }
        });
      } else {
        revealedHeight.value = withSpring(target, { damping: 18 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: revealedHeight.value,
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* react-native-gesture-handler requires its own GestureHandlerRootView around any
          content that lives inside a React Native `Modal` — a Modal renders to a separate
          native window/root that the app-wide GestureHandlerRootView in app/_layout.tsx
          does not extend into, so the swipe gesture below would silently fail to register
          without this. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          className="flex-1 justify-end bg-black/60"
          style={Platform.OS === 'web' ? { alignItems: 'center' } : undefined}>
          {/* Tap anywhere outside the sheet to close. Sits behind the sheet in z-order (the
              sheet is rendered after it below), so a tap that actually lands on the sheet's
              own bounds hits the sheet (or one of its inner Pressables) first. */}
          <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              { maxHeight: expandedHeight },
              Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MODAL_MAX_WIDTH } : undefined,
              animatedStyle,
            ]}
            className="overflow-hidden rounded-t-card bg-bg">
            <GestureDetector gesture={pan}>
              <View accessibilityLabel="Drag down to close, up to expand" className="items-center py-3">
                {/* `outline-variant` (used elsewhere for hairline dividers) is a ~10%-opacity
                    wash — nearly invisible for something meant to read as a grabbable handle.
                    `outline` is the same hue at full, solid opacity. */}
                <View className="h-1.5 w-12 rounded-full bg-outline" />
              </View>
            </GestureDetector>
            {/* Every sheet that holds a text field (bio editor, add-members search, send-to
                search, ...) needs its content to shift above the keyboard on its own — the
                sheet's own height is a fixed percentage of the screen (`revealedHeight` above),
                not something the keyboard opening changes by itself. */}
            <KeyboardAvoidingScreen>{children}</KeyboardAvoidingScreen>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
