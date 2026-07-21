import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface AuthTextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function AuthTextField({ label, error, ...inputProps }: AuthTextFieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </Text>
      <TextInput
        className={`rounded-xl border px-4 py-3 text-base text-neutral-900 dark:text-neutral-100 ${
          error ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
        }`}
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
