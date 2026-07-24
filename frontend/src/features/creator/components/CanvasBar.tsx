import { Pressable, ScrollView, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

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
        {ASPECT_PRESETS.map((preset) => {
          const active = canvas.aspectId === preset.id;
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityLabel={`Aspect ratio ${preset.label}, ${preset.hint}`}
              onPress={() => dispatch(updateCanvas({ aspectId: preset.id }))}
              className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-3 ${
                active ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text
                className={`text-sm font-bold ${active ? 'text-white' : 'text-neutral-900 dark:text-white'}`}>
                {preset.label}
              </Text>
              <Text className={`text-[10px] ${active ? 'text-white' : 'text-neutral-400'}`}>
                {preset.hint}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-row items-center">
        {FIT_OPTIONS.map((option) => {
          const active = canvas.fit === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Base image ${option.label}`}
              onPress={() => dispatch(updateCanvas({ fit: option.id }))}
              className={`mr-2 min-h-[44px] w-16 items-center justify-center rounded-xl border ${
                active ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text className={active ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}

        {canvas.fit === 'contain' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-1">
            {COLOR_SWATCHES.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Background ${color}`}
                onPress={() => dispatch(updateCanvas({ bg: color }))}
                style={{ backgroundColor: color }}
                className={`mr-2 h-11 w-11 rounded-full border-2 ${
                  canvas.bg === color ? 'border-orange-500' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}
