import { Image } from 'expo-image';
import { forwardRef, useState } from 'react';
import { View } from 'react-native';

import { DraggableText } from '@/features/creator/components/DraggableText';

interface OverlayCanvasProps {
  imageUri: string;
  topText: string;
  bottomText: string;
}

const TEXT_MARGIN = 16;

export const OverlayCanvas = forwardRef<View, OverlayCanvasProps>(
  ({ imageUri, topText, bottomText }, ref) => {
    const [size, setSize] = useState({ width: 0, height: 0 });

    return (
      <View
        ref={ref}
        // collapsable={false} keeps this View in the native tree on Android — without
        // it, view-shot's captureRef can silently capture a blank/wrong frame because
        // the RN renderer is free to flatten/optimize away an otherwise-plain wrapper.
        collapsable={false}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
        style={{ width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: 'black' }}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
        {size.width > 0 && size.height > 0 ? (
          <>
            <DraggableText
              text={topText}
              initialX={size.width / 2 - 80}
              initialY={TEXT_MARGIN}
              bounds={size}
            />
            <DraggableText
              text={bottomText}
              initialX={size.width / 2 - 80}
              initialY={size.height - 44 - TEXT_MARGIN}
              bounds={size}
            />
          </>
        ) : null}
      </View>
    );
  }
);
OverlayCanvas.displayName = 'OverlayCanvas';
