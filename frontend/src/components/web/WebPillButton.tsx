import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';

import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, type WebPressableState } from '@/constants/webCommunityTheme';

type Variant = 'primary' | 'outline' | 'ghost';

interface WebPillButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

/** Theme-aware pill button for the community web pages — same interaction contract as the
 * shared native `PillButton` (loading/disabled state, 44px min height) but new chrome, since
 * that component is native-resolved and aliases the old NativeWind token set. */
export default function WebPillButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  fullWidth = false,
}: WebPillButtonProps) {
  const { colors } = useCommunityWebTheme();
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary, borderWidth: 0 }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }
        : { backgroundColor: colors.elevated, borderWidth: 0 };

  const textColor = variant === 'primary' ? colors.onPrimary : variant === 'outline' ? colors.primary : colors.foreground;

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
        focused && !isDisabled && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[COMMUNITY_WEB_TYPE.title, { color: textColor }]}>{label}</Text>
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
    gap: COMMUNITY_WEB_SPACING.sm,
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.xl,
    paddingVertical: COMMUNITY_WEB_SPACING.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  hovered: {
    opacity: 0.9,
    transform: [{ translateY: -1 }],
  },
});
