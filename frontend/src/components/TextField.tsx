import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-label text-xs uppercase tracking-wide text-ink-muted">{label}</Text>
      <TextInput
        className={`min-h-[44px] rounded-full border bg-surface-high/60 px-5 py-3 font-body text-base text-heading ${
          error ? 'border-error' : 'border-outline-variant'
        }`}
        placeholderTextColor="#aa888f"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text className="mt-1 font-body text-xs text-error">{error}</Text> : null}
    </View>
  );
}
