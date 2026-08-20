import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

export interface CompeteTabOption<T extends string> {
  key: T;
  label: string;
}

interface WebCompeteTabsProps<T extends string> {
  options: CompeteTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Connected pill-track segmented control for `CompeteScreen`'s Challenges/Leaderboards toggle —
 * Vaporwave/Luminous equivalent of the retired independent-theme `WebCompeteTabs`. Built locally
 * (not imported from `WebVotingTabs.tsx` or `WebSegmentedControl.tsx`, both still hard-coupled to
 * their own screens/themes) — same "independent tree" precedent every Vaporwave web pilot
 * follows, even though this one and `WebVotingTabs` end up structurally identical.
 *
 * Selected fill is a flat `indigoSecondary` + `onAccent` (9.0:1 dark / 6.46:1 light, both ≥4.5:1
 * AA) — no gradient, per explicit instruction.
 */
export function WebCompeteTabs<T extends string>({ options, value, onChange }: WebCompeteTabsProps<T>) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={({ hovered, focused }: WebPressableState) => [
              styles.segment,
              selected && { backgroundColor: colors.indigoSecondary },
              hovered && !selected && { backgroundColor: colors.hoverTint },
              focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[type.title, { color: selected ? colors.onAccent : colors.foreground }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  });
