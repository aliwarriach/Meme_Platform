import { Pressable, Text } from 'react-native';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Translucent glass chip; turns opaque primary when selected. Used for filters, aspect-ratio presets, audience toggles. */
export default function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      className={`min-h-[36px] items-center justify-center rounded-full border px-4 py-1.5 ${
        selected ? 'border-primary bg-primary' : 'border-outline-variant bg-surface-high/60'
      }`}>
      <Text className={`font-label text-xs ${selected ? 'text-white' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}
