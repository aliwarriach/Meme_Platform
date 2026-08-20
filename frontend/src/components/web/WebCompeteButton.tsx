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
 * of the retired independent-theme `WebCompeteButton`. Primary variant carries a soft
 * `indigoGlow` shadow (decorative, exempt from text-contrast rules, same technique
 * `WebWinnerBanner` uses on Voting) instead of the retired Neubrutalism system's hard 3px offset
 * shadow — that shadow language ("no gradients, no blur") is specific to the style this page is
 * being migrated OFF of, and is incompatible with Vaporwave's glass/glow language.
 *
 * `outline`/`ghost` variants use a MODE-CONDITIONAL accent for border + text, never a fixed
 * token: `indigoPrimary` (cyan) measures ~11.7:1 against the dark canvas but only ~1.7:1 against
 * light; `indigoSecondary` (magenta) is the inverse — too-close-in-luminance against a dark
 * canvas/card (~1.6-1.9:1, under even the 3:1 non-text minimum) but ~6.5:1 against light. Neither
 * token is safe as a fixed border/text color across both modes, so the mode check picks whichever
 * one actually clears AA — same reasoning `WebCompeteTopBar`'s focus ring and every other
 * mode-conditional accent in this migration uses. `indigoSecondary` is never used as outline
 * border/text directly on `card`/background in this build for that reason (see
 * compete-web.md's Accessibility section).
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
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const isDisabled = disabled || loading;
  const accent = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

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
