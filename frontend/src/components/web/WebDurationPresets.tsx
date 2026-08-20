import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebDurationPresetsProps {
  /** Currently-entered minutes, as a string (matches the screens' own `durationMinutes` state) —
   * used only to highlight a matching preset, never to constrain input. */
  minutesValue: string;
  onSelect: (minutes: number) => void;
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 60 * 6 },
  { label: '1 day', minutes: 60 * 24 },
  { label: '3 days', minutes: 60 * 24 * 3 },
];

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * UX addition shared identically across all three create/propose screens
 * (`CreateOpenChallengeScreen`, `CreateChallengeScreen`, `ProposeVsChallengeScreen`) — carried
 * forward unchanged from the retired system's own genuine finding (see compete-web.md's "UX
 * improvements" history): each native screen requires typing a raw minutes value with no unit
 * hint, the same friction this app's own `DuelProposeModal` already solved with presets.
 * Additive only — the manual minutes field stays for custom durations. Now Vaporwave-themed.
 */
export function WebDurationPresets({ minutesValue, onSelect }: WebDurationPresetsProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const currentMinutes = Number(minutesValue);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={styles.row}>
      {PRESETS.map((preset) => {
        const selected = currentMinutes === preset.minutes;
        return (
          <Pressable
            key={preset.minutes}
            accessibilityRole="button"
            accessibilityLabel={`Set duration to ${preset.label}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(preset.minutes)}
            style={({ hovered, focused }: WebPressableState) => [
              styles.chip,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
              selected && { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary },
              hovered && !selected && { backgroundColor: colors.surfaceHover },
              focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[type.meta, { color: selected ? colors.onAccent : colors.foregroundMuted }]}>
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    chip: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
  });
