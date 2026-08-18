import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import {
  COMPETE_WEB_RADIUS,
  COMPETE_WEB_SHADOW,
  COMPETE_WEB_SPACING,
  COMPETE_WEB_TYPE,
  type WebPressableState,
} from '@/constants/webCompeteTheme';

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

/** Theme-aware pill button for the Compete web pages — same interaction contract as the shared
 * native `PillButton` (loading/disabled state, 44px min height) but new chrome, since that
 * component is native-resolved and aliases the old NativeWind token set. Primary variant carries
 * this page's signature `outline` + hard-offset-shadow emphasis treatment (see Shape signature
 * note in compete-web.md) — the loudest, most brutalist element on any given screen, matching
 * the brief's "energy belongs in... CTAs" instruction. */
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
  const { colors } = useCompeteWebTheme();
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === 'primary'
      ? {
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.outline,
          ...COMPETE_WEB_SHADOW.hard,
        }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary }
        : { backgroundColor: colors.elevated, borderWidth: 0 };

  const textColor =
    variant === 'primary' ? colors.onPrimary : variant === 'outline' ? colors.primaryText : colors.cardForeground;

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
        hovered && !isDisabled && (variant === 'primary' ? styles.hoveredPrimary : styles.hovered),
        focused && !isDisabled && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[COMPETE_WEB_TYPE.title, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: COMPETE_WEB_SPACING.sm,
    borderRadius: COMPETE_WEB_RADIUS.pill,
    paddingHorizontal: COMPETE_WEB_SPACING.xl,
    paddingVertical: COMPETE_WEB_SPACING.md,
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
  // Mechanical press: shift toward the shadow and drop it, rather than a soft opacity fade —
  // the Neubrutalism style's own "mechanical press: translateX/Y equal to shadow offset" note.
  hoveredPrimary: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 2, height: 2 },
  },
});
