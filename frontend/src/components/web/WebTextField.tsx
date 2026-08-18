import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE } from '@/constants/webCommunityTheme';

interface WebTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
}

/** Theme-aware text input for the community web pages (create-community form) — block-card
 * style, not a pill, per this page's "geometric shapes" style keywords. Standalone equivalent of
 * the native-resolved shared `components/TextField.tsx`. */
export function WebTextField({ label, value, onChangeText, error, multiline, keyboardType, placeholder }: WebTextFieldProps) {
  const { colors } = useCommunityWebTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMMUNITY_WEB_SPACING.xs }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.foregroundMuted}
        accessibilityLabel={label}
        style={[
          COMMUNITY_WEB_TYPE.body,
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      />
      {error ? (
        <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.destructive, marginTop: COMMUNITY_WEB_SPACING.xs }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: COMMUNITY_WEB_SPACING.lg,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.md,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
