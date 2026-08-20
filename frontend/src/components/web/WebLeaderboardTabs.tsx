import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

export type LeaderboardTabKey = 'individual' | 'communities';

interface TabOption {
  key: LeaderboardTabKey;
  label: string;
}

interface WebLeaderboardTabsProps {
  options: TabOption[];
  value: LeaderboardTabKey;
  onChange: (value: LeaderboardTabKey) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Connected pill-track segmented control for the Individual/Communities toggle — deliberately
 * built as a local, page-scoped copy rather than importing `WebVotingTabs` (typed to
 * `CompetitionPeriodType`, not this screen's `LeaderboardTabKey`) or `WebSegmentedControl.tsx`
 * (still hard-coupled to the un-migrated Communities theme, not Vaporwave) — same "independent
 * tree, no shared theme-coupled primitive" precedent every prior Vaporwave screen follows
 * (voting-web.md, compete-web.md).
 *
 * Selected fill uses `indigoSecondary` + `onAccent`, not `indigoPrimary` — the identical,
 * already-measured contrast pairing `WebVotingTabs` established (9.0:1 dark / 6.46:1 light,
 * vs `indigoPrimary`'s ~1.4:1 dark / ~1.7:1 light as a white-text fill). Carried forward, not
 * re-derived.
 */
export function WebLeaderboardTabs({ options, value, onChange }: WebLeaderboardTabsProps) {
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
