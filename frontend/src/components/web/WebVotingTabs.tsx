import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useVotingWebTheme } from '@/constants/VotingWebTheme';
import { VOTING_WEB_RADIUS, VOTING_WEB_SPACING, VOTING_WEB_TYPE, type WebPressableState } from '@/constants/webVotingTheme';
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

/** Connected pill-track segmented control for the Today/This Week/This Month period tabs —
 * replaces the native `Chip` row with a single track, same "block-based" affordance precedent
 * `community-web.md` used for its own tab rows. Built independently (not imported from
 * `WebSegmentedControl.tsx`, which is hard-coupled to the communities theme). */
export function WebVotingTabs({ options, value, onChange }: WebVotingTabsProps) {
  const { colors } = useVotingWebTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
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
              selected && { backgroundColor: colors.primary },
              hovered && !selected && { backgroundColor: colors.elevatedHover },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            {/* Unselected label uses full `foreground`, not `foregroundMuted` — measured contrast
                for `foregroundMuted` against this track's `elevated` background falls to ~4.1:1
                in light mode, under 4.5:1 AA (see webVotingTheme.ts). Hierarchy still reads
                clearly from the selected pill's solid fill, not from text-color dimming. */}
            <Text
              style={[
                VOTING_WEB_TYPE.title,
                { color: selected ? colors.onPrimary : colors.foreground },
              ]}>
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
    borderRadius: VOTING_WEB_RADIUS.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: VOTING_WEB_RADIUS.pill,
    paddingHorizontal: VOTING_WEB_SPACING.md,
    paddingVertical: VOTING_WEB_SPACING.sm,
  },
});
