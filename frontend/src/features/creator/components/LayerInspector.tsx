import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from '@/constants/ThemeMode';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import Chip from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import {
  COLOR_SWATCHES,
  FONT_OPTIONS,
  isTextLayer,
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
  return <Text className="mb-2 mt-3 font-label text-xs uppercase tracking-wide text-ink-muted">{children}</Text>;
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
        <View className="flex-row gap-2">
          {FONT_OPTIONS.map((font) => (
            <Chip
              key={font.id}
              label={font.label}
              selected={style.fontId === font.id}
              onPress={() => dispatch(updateSelectedStyle({ fontId: font.id }))}
            />
          ))}
        </View>
      </ScrollView>

      <SectionLabel>Color</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {COLOR_SWATCHES.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Text color ${color}`}
              onPress={() => dispatch(updateSelectedStyle({ color }))}
              style={{ backgroundColor: color }}
              className={`h-11 w-11 rounded-full border-2 ${
                style.color === color ? 'border-primary' : 'border-outline-variant'
              }`}
            />
          ))}
        </View>
      </ScrollView>

      <SectionLabel>Outline</SectionLabel>
      <View className="mb-2 flex-row gap-2">
        {STROKE_WIDTH_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={style.strokeWidthFraction === option.value}
            onPress={() => dispatch(updateSelectedStyle({ strokeWidthFraction: option.value }))}
          />
        ))}
      </View>
      {style.strokeWidthFraction > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {COLOR_SWATCHES.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={`Outline color ${color}`}
                onPress={() => dispatch(updateSelectedStyle({ strokeColor: color }))}
                style={{ backgroundColor: color }}
                className={`h-11 w-11 rounded-full border-2 ${
                  style.strokeColor === color ? 'border-primary' : 'border-outline-variant'
                }`}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      <SectionLabel>Align & effects</SectionLabel>
      <View className="flex-row items-center gap-2">
        {ALIGN_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={style.align === option.id}
            accessibilityLabel={`Align ${option.id}`}
            onPress={() => dispatch(updateSelectedStyle({ align: option.id }))}
          />
        ))}
        <Chip
          label="Shadow"
          selected={style.shadow}
          onPress={() => dispatch(updateSelectedStyle({ shadow: !style.shadow }))}
        />
      </View>
    </>
  );
}

// Contextual panel for the currently selected layer (text or image). Reads the layer from
// Redux; renders nothing when no layer is selected (the parent shows the add-layer row).
export function LayerInspector() {
  const dispatch = useDispatch<AppDispatch>();
  const layer = useSelector(selectSelectedLayer);
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  if (!layer) return null;

  return (
    <View className="mb-4 rounded-card border border-outline-variant/30 bg-surface p-3">
      {isTextLayer(layer) ? (
        <>
          <TextStyleControls layer={layer} />
          <Text className="mt-2 font-body text-xs text-ink-muted">
            Drag the 4 dots on its box: left/right resize how wide it wraps, top/bottom
            resize how tall — the text reflows to fit.
          </Text>
        </>
      ) : (
        <Text className="font-title text-sm text-ink-muted">
          Image layer — drag, pinch, and rotate on the canvas.
        </Text>
      )}

      <SectionLabel>Layer</SectionLabel>
      <View className="flex-row items-center gap-2">
        <LayerActionIcon
          icon="content-copy"
          accessibilityLabel="Duplicate layer"
          onPress={() => dispatch(duplicateSelected())}
        />
        <LayerActionIcon
          icon="flip-to-front"
          accessibilityLabel="Bring to front"
          onPress={() => dispatch(reorderSelected('front'))}
        />
        <LayerActionIcon
          icon="flip-to-back"
          accessibilityLabel="Send to back"
          onPress={() => dispatch(reorderSelected('back'))}
        />
        <LayerActionIcon
          icon="delete-outline"
          accessibilityLabel="Delete layer"
          tint={c.error}
          onPress={() => dispatch(deleteSelected())}
        />
        <View className="flex-1" />
        <LayerActionIcon
          icon="check"
          accessibilityLabel="Done editing this layer"
          filled
          onPress={() => dispatch(selectLayer(null))}
        />
      </View>
    </View>
  );
}

function LayerActionIcon({
  icon,
  accessibilityLabel,
  onPress,
  tint,
  filled = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  tint?: string;
  filled?: boolean;
}) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full border ${
        filled ? 'border-primary-container bg-primary-container' : 'border-outline-variant'
      }`}>
      <MaterialIcons name={icon} size={20} color={filled ? c.white : (tint ?? c.ink)} />
    </Pressable>
  );
}
