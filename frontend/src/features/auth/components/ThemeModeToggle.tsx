import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useThemeMode } from '@/constants/ThemeMode';
import type { ThemePreference } from '@/services/themeStorage';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'light', label: 'Use light mode', icon: 'light-mode' },
  { value: 'dark', label: 'Use dark mode', icon: 'dark-mode' },
  { value: 'system', label: 'Match device setting', icon: 'smartphone' },
];

/** Settings-row light/dark/system segmented pill — matches the `rounded-card`/`bg-surface` row
 * styling every other Profile entry uses, with a 3-option pill control (not a bare `Switch`) to
 * carry over the pill-shaped-control convention the rest of the design system uses. */
export function ThemeModeToggle() {
  const { mode, preference, setPreference } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  return (
    <View
      accessibilityRole="none"
      className="min-h-[52px] flex-row items-center justify-between rounded-card border border-outline-variant/30 bg-surface px-4 py-2">
      <Text className="font-title text-heading">Appearance</Text>
      <View className="flex-row items-center gap-1 rounded-full bg-surface-high/60 p-1">
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: preference === option.value }}
            onPress={() => setPreference(option.value)}
            className={`h-9 w-9 items-center justify-center rounded-full ${preference === option.value ? 'bg-primary-container' : ''}`}>
            <MaterialIcons
              name={option.icon}
              size={18}
              color={preference === option.value ? c.white : c.inkMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
