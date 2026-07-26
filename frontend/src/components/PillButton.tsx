import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type GestureResponderEvent } from 'react-native';

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

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-outline bg-transparent',
  ghost: 'bg-surface-high',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-heading',
  ghost: 'text-heading',
};

/** Pill-shaped action button — the primary interactive control of the "Vivid Meme Culture" design system. */
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full px-6 py-3 ${VARIANT_CLASSES[variant]} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#ffffff' : '#ffffff'} />
      ) : (
        <>
          {icon}
          <Text className={`font-title text-base ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
