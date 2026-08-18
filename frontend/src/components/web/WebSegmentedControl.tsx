import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, type WebPressableState } from '@/constants/webCommunityTheme';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

interface WebSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Theme-aware segmented tab control — replaces the native `Chip` row (My Communities/Discover
 * toggle, Feed/Members/Leaderboard/Challenges tabs) with a single connected pill track, a more
 * "block-based" affordance than loose chips for a fixed, mutually-exclusive option set. */
export function WebSegmentedControl<T extends string>({ options, value, onChange }: WebSegmentedControlProps<T>) {
  const { colors } = useCommunityWebTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.badge ? `${option.label}, ${option.badge} pending` : option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={({ hovered, focused }: WebPressableState) => [
              styles.segment,
              selected && { backgroundColor: colors.primary },
              hovered && !selected && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <Text
              style={[
                COMMUNITY_WEB_TYPE.title,
                { color: selected ? colors.onPrimary : colors.foregroundMuted },
              ]}>
              {option.label}
            </Text>
            {option.badge ? (
              <View style={[styles.badge, { backgroundColor: selected ? colors.onPrimary : colors.primary }]}>
                <Text style={[COMMUNITY_WEB_TYPE.meta, { color: selected ? colors.primary : colors.onPrimary, fontSize: 11 }]}>
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: COMMUNITY_WEB_SPACING.xs,
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.sm,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
