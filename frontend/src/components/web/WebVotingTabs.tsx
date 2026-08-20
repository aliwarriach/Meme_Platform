import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { CompetitionPeriodType } from '@/services/competitions';

interface TabOption {
  type: CompetitionPeriodType;
  label: string;
}

interface WebVotingTabsProps {
  options: TabOption[];
  value: CompetitionPeriodType;
  onChange: (value: CompetitionPeriodType) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Connected pill-track segmented control for the Today/This Week/This Month period tabs —
 * Vaporwave/Luminous equivalent of the retired independent-theme `WebVotingTabs`. Built locally
 * rather than importing `WebSegmentedControl.tsx` (still hard-coupled to the un-migrated
 * communities theme) or `WebCompeteTabs.tsx` (same, compete theme) — same "independent tree"
 * precedent every other web pilot in this app follows.
 *
 * Selected fill is a flat `indigoSecondary` + `onAccent` text (9.0:1 dark / 6.46:1 light,
 * comfortably clears 4.5:1 AA) — no gradient, per explicit instruction.
 */
export function WebVotingTabs({ options, value, onChange }: WebVotingTabsProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.type === value;
        return (
          <Pressable
            key={option.type}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.type)}
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
