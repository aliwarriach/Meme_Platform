import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebCompeteTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
}

/**
 * Theme-aware text input for the Compete/Challenges web forms (create/propose challenge screens)
 * — Vaporwave/Luminous equivalent of the retired independent-theme `WebCompeteTextField`. Uses
 * `surfaceElevated` (a near-opaque panel tone in both modes) rather than `surfaceGlass`
 * (10%/75%-opacity translucent) for the input fill, since typed text needs a stable, legible
 * surface behind it, not a see-through one — no other Vaporwave screen has needed a text input
 * yet, so this is this migration's own grounded choice, not a copied precedent.
 */
export function WebCompeteTextField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  hint,
}: WebCompeteTextFieldProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);

  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.xs }]}>{label}</Text>
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
          type.body,
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surfaceElevated,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      />
      {error ? (
        <Text style={[type.meta, { color: colors.error, marginTop: spacing.xs }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.meta, { color: colors.foregroundMuted, marginTop: spacing.xs }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    wrap: {
      marginBottom: spacing.lg,
    },
    input: {
      minHeight: 48,
      borderWidth: 1.5,
      borderRadius: radius.chip,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
  });
