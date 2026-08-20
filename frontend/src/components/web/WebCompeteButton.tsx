import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

type Variant = 'primary' | 'outline' | 'ghost';

interface WebCompeteButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Theme-aware pill button for the Compete/Challenges web pages — Vaporwave/Luminous equivalent
 * of the retired independent-theme `WebCompeteButton`. Primary variant is a flat `indigoSecondary`
 * fill (no gradient, per explicit instruction) with a soft `indigoGlow` shadow.
 *
 * `outline`/`ghost` variants use the fixed `accentPurple` token for border + text, not a
 * mode-conditional pink swap: `accentPurple` clears 4.5:1 text contrast in BOTH modes on its own
 * (6.62:1 dark / ~7:1 light — see `webFeedThemeVapor.ts`), so the old per-mode ternary was solving
 * a problem purple doesn't have. This also gives purple its own real "secondary action" identity
 * across every Compete screen, distinct from primary pink CTAs, instead of just reusing pink at
 * lower emphasis.
 */
export default function WebCompeteButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  fullWidth = false,
}: WebCompeteButtonProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const isDisabled = disabled || loading;
  const accent = colors.accentPurple;

  const variantStyle =
    variant === 'primary'
      ? {
          backgroundColor: colors.indigoSecondary,
          shadowColor: colors.indigoGlow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 14,
          elevation: 4,
        }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: accent }
        : { backgroundColor: colors.surfaceElevated, borderWidth: 0 };

  const textColor = variant === 'primary' ? colors.onAccent : variant === 'outline' ? accent : colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ hovered, focused }: WebPressableState) => [
        styles.base,
        variantStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        hovered && !isDisabled && styles.hovered,
        focused && !isDisabled && { outlineColor: accent, outlineWidth: 2, outlineOffset: 2 },
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[type.title, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    fullWidth: {
      width: '100%',
    },
    disabled: {
      opacity: 0.5,
    },
    hovered: {
      opacity: 0.9,
    },
  });
