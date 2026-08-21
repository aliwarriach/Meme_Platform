import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Pressable, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { selectThemeMode, toggleThemeMode } from '@/store/themeSlice';
import type { AppDispatch } from '@/store/store';

/** Settings-row light/dark segmented pill — matches the `rounded-card`/`bg-surface` row styling
 * every other Profile entry uses, with a two-option pill control (not a bare `Switch`) to carry
 * over the pill-shaped-control convention the rest of the design system uses. */
export function ThemeModeToggle() {
  const dispatch = useDispatch<AppDispatch>();
  const mode = useSelector(selectThemeMode);
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  const onSelect = (next: 'light' | 'dark') => {
    if (next !== mode) dispatch(toggleThemeMode());
  };

  return (
    <View
      accessibilityRole="none"
      className="min-h-[52px] flex-row items-center justify-between rounded-card border border-outline-variant/30 bg-surface px-4 py-2">
      <Text className="font-title text-heading">Appearance</Text>
      <View className="flex-row items-center gap-1 rounded-full bg-surface-high/60 p-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use light mode"
          accessibilityState={{ selected: mode === 'light' }}
          onPress={() => onSelect('light')}
          className={`h-9 w-9 items-center justify-center rounded-full ${mode === 'light' ? 'bg-primary-container' : ''}`}>
          <MaterialIcons name="light-mode" size={18} color={mode === 'light' ? c.white : c.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use dark mode"
          accessibilityState={{ selected: mode === 'dark' }}
          onPress={() => onSelect('dark')}
          className={`h-9 w-9 items-center justify-center rounded-full ${mode === 'dark' ? 'bg-primary-container' : ''}`}>
          <MaterialIcons name="dark-mode" size={18} color={mode === 'dark' ? c.white : c.inkMuted} />
        </Pressable>
      </View>
    </View>
  );
}
