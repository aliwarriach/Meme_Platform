import { Pressable, ScrollView, Text, View } from 'react-native';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Native equivalent of `components/web/WebSegmentedControl.tsx` — a connected track with a
 * solid `primary-container` fill on the selected segment, instead of a row of individually-
 * bordered `Chip`s. Single line always: `flexWrap` is deliberately off here — on a phone width,
 * 4+ labels (one as long as "Leaderboard") don't fit at a readable size
 * without either wrapping a label to a second row (pushes later options below the fold, which is
 * the exact thing this was asked not to do) or shrinking text/padding. Horizontal scroll keeps
 * every option on the one row and reachable, the same tradeoff most native tab bars with more
 * options than screen width make (Twitter/Instagram's own top tab strips both scroll sideways
 * rather than wrap). */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      <View
        accessibilityRole="tablist"
        className="flex-row items-center gap-1 rounded-full border border-outline-variant bg-surface-high/60 p-1">
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.key)}
              className={`min-h-[40px] flex-row items-center justify-center rounded-full px-4 py-2 ${
                selected ? 'bg-primary-container' : ''
              }`}>
              <Text className={`font-title text-base ${selected ? 'text-white' : 'text-ink-muted'}`} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
