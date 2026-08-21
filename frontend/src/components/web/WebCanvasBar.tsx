import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { ASPECT_PRESETS, COLOR_SWATCHES, type CanvasFit } from '@/features/creator/document';
import { selectDocument, updateCanvas } from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

const FIT_OPTIONS: { id: CanvasFit; label: string }[] = [
  { id: 'contain', label: 'Fit' },
  { id: 'cover', label: 'Fill' },
];

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Themed replacement for `features/creator/components/CanvasBar.tsx` — aspect-ratio presets,
 * Fit/Fill toggle, and letterbox-color swatches (contain-only). Local chip primitives, not a
 * shared import — same "independent tree" precedent `WebCompeteTabs`/`WebSideMemberPicker`
 * already establish for this codebase, since neither existing pill-track (`WebSegmentedControl`,
 * community theme) nor `WebCompeteTabs` (single-label, non-scrolling) fit a 5-option scrollable
 * two-line chip row.
 */
export function WebCanvasBar() {
  const dispatch = useDispatch<AppDispatch>();
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const canvas = useSelector(selectDocument).canvas;
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aspectScroll}>
        <View style={styles.row}>
          {ASPECT_PRESETS.map((preset) => {
            const active = canvas.aspectId === preset.id;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={`Aspect ratio ${preset.label}, ${preset.hint}`}
                accessibilityState={{ selected: active }}
                onPress={() => dispatch(updateCanvas({ aspectId: preset.id }))}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.aspectChip,
                  active
                    ? { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary }
                    : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                  hovered && !active && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <Text style={[type.label, { color: active ? colors.onAccent : colors.foregroundMuted }]}>
                  {preset.label}
                </Text>
                <Text style={[type.meta, styles.aspectHint, { color: active ? colors.onAccent : colors.foregroundMuted }]}>
                  {preset.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.fitRow}>
        {FIT_OPTIONS.map((option) => {
          const active = canvas.fit === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Base image ${option.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => dispatch(updateCanvas({ fit: option.id }))}
              style={({ hovered, focused }: WebPressableState) => [
                styles.fitChip,
                active
                  ? { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary }
                  : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                hovered && !active && { backgroundColor: colors.surfaceHover },
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
              ]}>
              <Text style={[type.label, { color: active ? colors.onAccent : colors.foregroundMuted }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}

        {canvas.fit === 'contain' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swatchScroll}>
            <View style={styles.row}>
              {COLOR_SWATCHES.map((color) => {
                const active = canvas.bg === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityRole="button"
                    accessibilityLabel={`Background ${color}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => dispatch(updateCanvas({ bg: color }))}
                    style={({ hovered, focused }: WebPressableState) => [
                      styles.swatch,
                      { backgroundColor: color, borderColor: active ? colors.indigoSecondary : colors.borderSolid },
                      hovered && { opacity: 0.85 },
                      focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                    ]}
                  />
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      marginBottom: spacing.md,
    },
    aspectScroll: {
      marginBottom: spacing.sm,
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    aspectChip: {
      minHeight: 48,
      minWidth: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.chip,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    aspectHint: {
      fontSize: 10,
      marginTop: 2,
    },
    fitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fitChip: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing.lg,
    },
    swatchScroll: {
      flex: 1,
      flexGrow: 0,
    },
    swatch: {
      height: 40,
      width: 40,
      borderRadius: 20,
      borderWidth: 2,
    },
  });
