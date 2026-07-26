import { ScrollView, Pressable, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import Chip from '@/components/Chip';
import {
  ASPECT_PRESETS,
  COLOR_SWATCHES,
  type CanvasFit,
} from '@/features/creator/document';
import { selectDocument, updateCanvas } from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

const FIT_OPTIONS: { id: CanvasFit; label: string }[] = [
  { id: 'contain', label: 'Fit' },
  { id: 'cover', label: 'Fill' },
];

// Canvas controls: aspect-ratio presets (share targets), how the base image fills the
// frame (Fit letterboxes, Fill center-crops), and the letterbox color when fitting.
export function CanvasBar() {
  const dispatch = useDispatch<AppDispatch>();
  const canvas = useSelector(selectDocument).canvas;

  return (
    <View className="mb-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        <View className="flex-row gap-2">
          {ASPECT_PRESETS.map((preset) => {
            const active = canvas.aspectId === preset.id;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={`Aspect ratio ${preset.label}, ${preset.hint}`}
                accessibilityState={{ selected: active }}
                onPress={() => dispatch(updateCanvas({ aspectId: preset.id }))}
                className={`min-h-[44px] items-center justify-center rounded-full border px-4 py-1.5 ${
                  active ? 'border-primary bg-primary' : 'border-outline-variant bg-surface-high/60'
                }`}>
                <Text className={`font-label text-xs ${active ? 'text-white' : 'text-ink-muted'}`}>
                  {preset.label}
                </Text>
                <Text className={`text-[10px] ${active ? 'text-white/80' : 'text-ink-muted/70'}`}>
                  {preset.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row items-center gap-2">
        {FIT_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={canvas.fit === option.id}
            accessibilityLabel={`Base image ${option.label}`}
            onPress={() => dispatch(updateCanvas({ fit: option.id }))}
          />
        ))}

        {canvas.fit === 'contain' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-1">
            <View className="flex-row gap-2">
              {COLOR_SWATCHES.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Background ${color}`}
                  onPress={() => dispatch(updateCanvas({ bg: color }))}
                  style={{ backgroundColor: color }}
                  className={`h-11 w-11 rounded-full border-2 ${
                    canvas.bg === color ? 'border-primary' : 'border-outline-variant'
                  }`}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}
