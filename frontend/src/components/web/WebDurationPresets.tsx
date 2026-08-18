import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';

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

/**
 * UX addition shared identically across all three create/propose screens
 * (`CreateOpenChallengeScreen`, `CreateChallengeScreen`, `ProposeVsChallengeScreen`) — see
 * compete-web.md's "UX improvements" section. Real, identical gap on all three native screens:
 * each requires typing a raw minutes value with no unit hint, the same friction this app's own
 * `DuelProposeModal` already solved with presets for its own challenge-creation flow. Additive
 * only — the manual minutes field stays for custom durations.
 */
export function WebDurationPresets({ minutesValue, onSelect }: WebDurationPresetsProps) {
  const { colors } = useCompeteWebTheme();
  const currentMinutes = Number(minutesValue);

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
              { borderColor: colors.border, backgroundColor: colors.card },
              selected && { backgroundColor: colors.primary, borderColor: colors.outline, borderWidth: 2 },
              hovered && !selected && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[COMPETE_WEB_TYPE.meta, { color: selected ? colors.onPrimary : colors.foregroundMuted }]}>
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COMPETE_WEB_SPACING.sm,
    marginBottom: COMPETE_WEB_SPACING.lg,
  },
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: COMPETE_WEB_RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: COMPETE_WEB_SPACING.md,
    paddingVertical: COMPETE_WEB_SPACING.xs,
  },
});
