import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
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

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

type Colors = VaporwaveTheme['colors'];
type Type = VaporwaveTheme['type'];
type Radius = VaporwaveTheme['radius'];
type Spacing = VaporwaveTheme['spacing'];

function SectionLabel({ children, colors, type, spacing }: { children: string; colors: Colors; type: Type; spacing: Spacing }) {
  return (
    <Text style={[type.label, { color: colors.foregroundMuted, marginTop: spacing.md, marginBottom: spacing.sm }]}>
      {children}
    </Text>
  );
}

function WebChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  colors,
  type,
  radius,
  spacing,
  ringColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  colors: Colors;
  type: Type;
  radius: Radius;
  spacing: Spacing;
  ringColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        chipStyles.base,
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          backgroundColor: selected ? colors.indigoSecondary : colors.surfaceElevated,
          borderColor: selected ? colors.indigoSecondary : colors.borderSolid,
        },
        hovered && !selected && { backgroundColor: colors.surfaceHover },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <Text style={[type.label, { color: selected ? colors.onAccent : colors.foregroundMuted }]}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});

function ColorSwatchRow({
  colors: swatches,
  selected,
  onSelect,
  accessibilityLabelPrefix,
  theme,
  ringColor,
}: {
  colors: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
  accessibilityLabelPrefix: string;
  theme: VaporwaveTheme;
  ringColor: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {swatches.map((color) => {
          const active = selected === color;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`${accessibilityLabelPrefix} ${color}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(color)}
              style={({ hovered, focused }: WebPressableState) => [
                {
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  borderWidth: 2,
                  backgroundColor: color,
                  borderColor: active ? theme.colors.indigoSecondary : theme.colors.borderSolid,
                },
                hovered && { opacity: 0.85 },
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
              ]}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

function TextStyleControls({ layer, theme, ringColor }: { layer: TextLayer; theme: VaporwaveTheme; ringColor: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const { colors, type, radius, spacing } = theme;
  const { style } = layer;

  return (
    <>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.xs }]}>Text</Text>
      <TextInput
        value={layer.text}
        onChangeText={(text) => dispatch(setSelectedText(text))}
        multiline
        autoCapitalize="sentences"
        accessibilityLabel="Layer text"
        placeholder="Type your meme text"
        placeholderTextColor={colors.foregroundMuted}
        style={[
          type.body,
          {
            minHeight: 64,
            textAlignVertical: 'top',
            borderWidth: 1.5,
            borderRadius: radius.chip,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.foreground,
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSolid,
          },
        ]}
      />

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Font
      </SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {FONT_OPTIONS.map((font) => (
            <WebChip
              key={font.id}
              label={font.label}
              selected={style.fontId === font.id}
              onPress={() => dispatch(updateSelectedStyle({ fontId: font.id }))}
              colors={colors}
              type={type}
              radius={radius}
              spacing={spacing}
              ringColor={ringColor}
            />
          ))}
        </View>
      </ScrollView>

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Color
      </SectionLabel>
      <ColorSwatchRow
        colors={COLOR_SWATCHES}
        selected={style.color}
        onSelect={(color) => dispatch(updateSelectedStyle({ color }))}
        accessibilityLabelPrefix="Text color"
        theme={theme}
        ringColor={ringColor}
      />

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Outline
      </SectionLabel>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        {STROKE_WIDTH_OPTIONS.map((option) => (
          <WebChip
            key={option.id}
            label={option.label}
            selected={style.strokeWidthFraction === option.value}
            onPress={() => dispatch(updateSelectedStyle({ strokeWidthFraction: option.value }))}
            colors={colors}
            type={type}
            radius={radius}
            spacing={spacing}
            ringColor={ringColor}
          />
        ))}
      </View>
      {style.strokeWidthFraction > 0 ? (
        <ColorSwatchRow
          colors={COLOR_SWATCHES}
          selected={style.strokeColor}
          onSelect={(color) => dispatch(updateSelectedStyle({ strokeColor: color }))}
          accessibilityLabelPrefix="Outline color"
          theme={theme}
          ringColor={ringColor}
        />
      ) : null}

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Align & effects
      </SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {ALIGN_OPTIONS.map((option) => (
          <WebChip
            key={option.id}
            label={option.label}
            selected={style.align === option.id}
            accessibilityLabel={`Align ${option.id}`}
            onPress={() => dispatch(updateSelectedStyle({ align: option.id }))}
            colors={colors}
            type={type}
            radius={radius}
            spacing={spacing}
            ringColor={ringColor}
          />
        ))}
        <WebChip
          label="Shadow"
          selected={style.shadow}
          onPress={() => dispatch(updateSelectedStyle({ shadow: !style.shadow }))}
          colors={colors}
          type={type}
          radius={radius}
          spacing={spacing}
          ringColor={ringColor}
        />
      </View>
    </>
  );
}

function LayerActionIcon({
  icon,
  accessibilityLabel,
  onPress,
  theme,
  ringColor,
  tint,
  filled = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  theme: VaporwaveTheme;
  ringColor: string;
  tint?: string;
  filled?: boolean;
}) {
  const { colors } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        {
          height: 44,
          width: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 22,
          borderWidth: 1.5,
          backgroundColor: filled ? colors.indigoSecondary : colors.surfaceElevated,
          borderColor: filled ? colors.indigoSecondary : colors.borderSolid,
        },
        hovered && !filled && { backgroundColor: colors.surfaceHover },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <MaterialIcons name={icon} size={20} color={filled ? colors.onAccent : (tint ?? colors.foreground)} />
    </Pressable>
  );
}

/**
 * Themed replacement for `features/creator/components/LayerInspector.tsx`. Renders nothing
 * with no layer selected (parent shows the add-layer row instead). Text-input chrome is a
 * local `TextInput` (not `WebCompeteTextField`, which has no `multiline` support and this
 * needs it for multi-line meme captions) styled to match that field's own border/fill
 * convention exactly, per this codebase's "independent tree, matched style" precedent.
 */
export function WebLayerInspector() {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useVaporwaveTheme();
  const { colors, type, radius, spacing, mode } = theme;
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const layer = useSelector(selectSelectedLayer);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  if (!layer) return null;

  const stepScale = (factor: number) => dispatch(setSelectedScale(clampScale(layer.scale * factor)));

  return (
    <View style={styles.card}>
      {isTextLayer(layer) ? (
        <TextStyleControls layer={layer} theme={theme} ringColor={ringColor} />
      ) : (
        <Text style={[type.title, { color: colors.foregroundMuted }]}>
          Image layer — drag, pinch, and rotate on the canvas.
        </Text>
      )}

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Size
      </SectionLabel>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease size"
          onPress={() => stepScale(1 / SCALE_STEP)}
          style={({ hovered, focused }: WebPressableState) => [
            styles.scaleButton,
            hovered && { backgroundColor: colors.surfaceHover },
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <Text style={[type.h2, { color: colors.foreground }]}>A−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase size"
          onPress={() => stepScale(SCALE_STEP)}
          style={({ hovered, focused }: WebPressableState) => [
            styles.scaleButton,
            hovered && { backgroundColor: colors.surfaceHover },
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <Text style={[type.display, { color: colors.foreground }]}>A+</Text>
        </Pressable>
      </View>

      <SectionLabel colors={colors} type={type} spacing={spacing}>
        Layer
      </SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <LayerActionIcon
          icon="content-copy"
          accessibilityLabel="Duplicate layer"
          onPress={() => dispatch(duplicateSelected())}
          theme={theme}
          ringColor={ringColor}
        />
        <LayerActionIcon
          icon="flip-to-front"
          accessibilityLabel="Bring to front"
          onPress={() => dispatch(reorderSelected('front'))}
          theme={theme}
          ringColor={ringColor}
        />
        <LayerActionIcon
          icon="flip-to-back"
          accessibilityLabel="Send to back"
          onPress={() => dispatch(reorderSelected('back'))}
          theme={theme}
          ringColor={ringColor}
        />
        <LayerActionIcon
          icon="delete-outline"
          accessibilityLabel="Delete layer"
          tint={colors.error}
          onPress={() => dispatch(deleteSelected())}
          theme={theme}
          ringColor={ringColor}
        />
        <View style={{ flex: 1 }} />
        <LayerActionIcon
          icon="check"
          accessibilityLabel="Done editing this layer"
          filled
          onPress={() => dispatch(selectLayer(null))}
          theme={theme}
          ringColor={ringColor}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: Colors, radius: Radius, spacing: Spacing) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      padding: spacing.md,
    },
    scaleButton: {
      minHeight: 44,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderSolid,
    },
  });
