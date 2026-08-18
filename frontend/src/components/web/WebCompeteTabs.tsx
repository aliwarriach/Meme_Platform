import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';

export interface CompeteTabOption<T extends string> {
  key: T;
  label: string;
}

interface WebCompeteTabsProps<T extends string> {
  options: CompeteTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Connected pill-track segmented control for `CompeteScreen`'s Challenges/Leaderboards toggle —
 * replaces the native `Chip` row, same "block-based" affordance precedent every prior web page
 * used for its own tab rows. Built independently (generic, not imported from any other page's
 * theme-coupled segmented control). */
export function WebCompeteTabs<T extends string>({ options, value, onChange }: WebCompeteTabsProps<T>) {
  const { colors } = useCompeteWebTheme();

  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
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
              selected && { backgroundColor: colors.primary },
              hovered && !selected && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text style={[COMPETE_WEB_TYPE.title, { color: selected ? colors.onPrimary : colors.cardForeground }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: COMPETE_WEB_RADIUS.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: COMPETE_WEB_RADIUS.pill,
    paddingHorizontal: COMPETE_WEB_SPACING.md,
    paddingVertical: COMPETE_WEB_SPACING.sm,
  },
});
