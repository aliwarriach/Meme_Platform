import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';

interface WebCompeteTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
}

/** Theme-aware text input for the Compete web forms (create/propose challenge screens) —
 * block-card style with a solid border, not a pill, matching this page's "flat, hard-edged"
 * Neubrutalism style keywords. Standalone equivalent of the native-resolved shared
 * `components/TextField.tsx`. */
export function WebCompeteTextField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  hint,
}: WebCompeteTextFieldProps) {
  const { colors } = useCompeteWebTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[COMPETE_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMPETE_WEB_SPACING.xs }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.foregroundMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        style={[
          COMPETE_WEB_TYPE.body,
          styles.input,
          {
            color: colors.cardForeground,
            backgroundColor: colors.card,
            borderColor: error ? colors.destructiveText : colors.border,
          },
        ]}
      />
      {error ? (
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.destructiveText, marginTop: COMPETE_WEB_SPACING.xs }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.foregroundMuted, marginTop: COMPETE_WEB_SPACING.xs }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: COMPETE_WEB_SPACING.lg,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: COMPETE_WEB_RADIUS.chip,
    paddingHorizontal: COMPETE_WEB_SPACING.lg,
    paddingVertical: COMPETE_WEB_SPACING.md,
  },
});
