import { useThemeMode } from '@/constants/ThemeMode';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-label text-xs uppercase tracking-wide text-ink-muted">{label}</Text>
      <TextInput
        className={`min-h-[44px] rounded-full border bg-surface-high/60 px-5 py-3 font-body text-base text-heading ${
          error ? 'border-error' : 'border-outline-variant'
        }`}
        placeholderTextColor={c.outline}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text className="mt-1 font-body text-xs text-error">{error}</Text> : null}
    </View>
  );
}
