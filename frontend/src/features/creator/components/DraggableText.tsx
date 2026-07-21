import { StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const BOX_WIDTH = 160;
const BOX_HEIGHT = 44;

interface DraggableTextProps {
  text: string;
  initialX: number;
  initialY: number;
  bounds: { width: number; height: number };
}

export function DraggableText({ text, initialX, initialY, bounds }: DraggableTextProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Clamps against the box's *assumed* footprint (not measured text width) — text
  // content varies, so this is an approximation that keeps the handle draggable
  // within the image rather than pixel-exact edge clamping.
  const minX = -initialX;
  const maxX = bounds.width - initialX - BOX_WIDTH;
  const minY = -initialY;
  const maxY = bounds.height - initialY - BOX_HEIGHT;

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = Math.min(Math.max(startX.value + event.translationX, minX), maxX);
      translateY.value = Math.min(Math.max(startY.value + event.translationY, minY), maxY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  if (!text) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { position: 'absolute', left: initialX, top: initialY, width: BOX_WIDTH },
          animatedStyle,
        ]}>
        <Text numberOfLines={2} style={styles.text}>
          {text.toUpperCase()}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  text: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
