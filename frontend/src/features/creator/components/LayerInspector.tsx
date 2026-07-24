import { Pressable, ScrollView, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { TextField } from '@/components/TextField';
import {
  clampScale,
  COLOR_SWATCHES,
  FONT_OPTIONS,
  isTextLayer,
  SCALE_STEP,
  STROKE_WIDTH_OPTIONS,
  type TextAlignId,
  type TextLayer,
} from '@/features/creator/document';
import {
  deleteSelected,
  duplicateSelected,
  reorderSelected,
  selectLayer,
  selectSelectedLayer,
  setSelectedScale,
  setSelectedText,
  updateSelectedStyle,
} from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

const ALIGN_OPTIONS: { id: TextAlignId; label: string }[] = [
  { id: 'left', label: 'L' },
  { id: 'center', label: 'C' },
  { id: 'right', label: 'R' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
      {children}
    </Text>
  );
}

// Text-only styling controls, kept in a child so the discriminated-union narrowing to
// TextLayer stays local and the parent handles both kinds cleanly.
function TextStyleControls({ layer }: { layer: TextLayer }) {
  const dispatch = useDispatch<AppDispatch>();
  const { style } = layer;
  return (
    <>
      <TextField
        label="Text"
        value={layer.text}
        onChangeText={(text) => dispatch(setSelectedText(text))}
        multiline
        autoCapitalize="sentences"
      />

      <SectionLabel>Font</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {FONT_OPTIONS.map((font) => {
          const active = style.fontId === font.id;
          return (
            <Pressable
              key={font.id}
              accessibilityRole="button"
              accessibilityLabel={`Font ${font.label}`}
              onPress={() => dispatch(updateSelectedStyle({ fontId: font.id }))}
              className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
                active ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text className={active ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                {font.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionLabel>Color</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {COLOR_SWATCHES.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Text color ${color}`}
            onPress={() => dispatch(updateSelectedStyle({ color }))}
            style={{ backgroundColor: color }}
            className={`mr-2 h-11 w-11 rounded-full border-2 ${
              style.color === color ? 'border-orange-500' : 'border-neutral-300 dark:border-neutral-600'
            }`}
          />
        ))}
      </ScrollView>

      <SectionLabel>Outline</SectionLabel>
      <View className="mb-2 flex-row">
        {STROKE_WIDTH_OPTIONS.map((option) => {
          const active = style.strokeWidthFraction === option.value;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Outline ${option.label}`}
              onPress={() => dispatch(updateSelectedStyle({ strokeWidthFraction: option.value }))}
              className={`mr-2 min-h-[44px] flex-1 items-center justify-center rounded-xl border px-3 ${
                active ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text className={active ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {style.strokeWidthFraction > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {COLOR_SWATCHES.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Outline color ${color}`}
              onPress={() => dispatch(updateSelectedStyle({ strokeColor: color }))}
              style={{ backgroundColor: color }}
              className={`mr-2 h-11 w-11 rounded-full border-2 ${
                style.strokeColor === color
                  ? 'border-orange-500'
                  : 'border-neutral-300 dark:border-neutral-600'
              }`}
            />
          ))}
        </ScrollView>
      ) : null}

      <SectionLabel>Align & effects</SectionLabel>
      <View className="flex-row">
        {ALIGN_OPTIONS.map((option) => {
          const active = style.align === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Align ${option.id}`}
              onPress={() => dispatch(updateSelectedStyle({ align: option.id }))}
              className={`mr-2 min-h-[44px] w-14 items-center justify-center rounded-xl border ${
                active ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text className={active ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle shadow"
          onPress={() => dispatch(updateSelectedStyle({ shadow: !style.shadow }))}
          className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border px-3 ${
            style.shadow ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 dark:border-neutral-700'
          }`}>
          <Text className={style.shadow ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
            Shadow
          </Text>
        </Pressable>
      </View>
    </>
  );
}

// Contextual panel for the currently selected layer (text or image). Reads the layer from
// Redux; renders nothing when no layer is selected (the parent shows the add-layer row).
export function LayerInspector() {
  const dispatch = useDispatch<AppDispatch>();
  const layer = useSelector(selectSelectedLayer);
  if (!layer) return null;

  const stepScale = (factor: number) =>
    dispatch(setSelectedScale(clampScale(layer.scale * factor)));

  return (
    <View className="mb-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
      {isTextLayer(layer) ? (
        <TextStyleControls layer={layer} />
      ) : (
        <Text className="text-sm font-semibold text-neutral-500">
          Image layer — drag, pinch, and rotate on the canvas.
        </Text>
      )}

      <SectionLabel>Size</SectionLabel>
      <View className="flex-row">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease size"
          onPress={() => stepScale(1 / SCALE_STEP)}
          className="mr-2 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-neutral-300 dark:border-neutral-700">
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">A−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase size"
          onPress={() => stepScale(SCALE_STEP)}
          className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-neutral-300 dark:border-neutral-700">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">A+</Text>
        </Pressable>
      </View>

      <SectionLabel>Layer</SectionLabel>
      <View className="flex-row flex-wrap">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Duplicate layer"
          onPress={() => dispatch(duplicateSelected())}
          className="mb-2 mr-2 min-h-[44px] items-center justify-center rounded-xl border border-neutral-300 px-4 dark:border-neutral-700">
          <Text className="font-semibold text-neutral-900 dark:text-white">Duplicate</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bring to front"
          onPress={() => dispatch(reorderSelected('front'))}
          className="mb-2 mr-2 min-h-[44px] items-center justify-center rounded-xl border border-neutral-300 px-4 dark:border-neutral-700">
          <Text className="font-semibold text-neutral-900 dark:text-white">To front</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send to back"
          onPress={() => dispatch(reorderSelected('back'))}
          className="mb-2 mr-2 min-h-[44px] items-center justify-center rounded-xl border border-neutral-300 px-4 dark:border-neutral-700">
          <Text className="font-semibold text-neutral-900 dark:text-white">To back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete layer"
          onPress={() => dispatch(deleteSelected())}
          className="mb-2 mr-2 min-h-[44px] items-center justify-center rounded-xl border border-red-500 px-4">
          <Text className="font-semibold text-red-500">Delete</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deselect"
          onPress={() => dispatch(selectLayer(null))}
          className="mb-2 min-h-[44px] items-center justify-center rounded-xl bg-neutral-900 px-4 dark:bg-white">
          <Text className="font-bold text-white dark:text-neutral-900">Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
