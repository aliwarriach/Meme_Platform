import type { ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Pressable, Text, type GestureResponderEvent } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

type PillButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  className?: string;
};

// `primary`/`secondary` use their `-container` fill-safe variants, not the bright base tokens
// themselves (ring/icon-safe, not safe white-text fills) — see `constants/theme.ts`.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary-container',
  secondary: 'bg-secondary-container',
  outline: 'border border-outline bg-transparent',
  ghost: 'bg-surface-high',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-heading',
  ghost: 'text-heading',
};

/** Pill-shaped action button — the primary interactive control of the "Neon Plum" design system.
 * The `primary` variant carries a soft glow shadow (`primaryGlow`) to match the gradient/glow CTA
 * treatment web established for primary actions. */
export default function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  className,
}: PillButtonProps) {
  const isDisabled = disabled || loading;
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const spinnerColor = variant === 'outline' || variant === 'ghost' ? c.heading : c.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      style={
        variant === 'primary' && !isDisabled
          ? {
              shadowColor: c.primaryGlow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 10,
              elevation: 6,
            }
          : undefined
      }
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full px-6 py-3 ${VARIANT_CLASSES[variant]} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text className={`font-title text-base ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
