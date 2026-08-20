import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebSubmissionThumbProps {
  imageUrl: string;
  caption?: string | null;
  onPress?: () => void;
  disabled?: boolean;
  /** e.g. "Submitted" / "Submit" / a submitter username — rendered under the thumbnail. */
  footerLabel?: string;
}

/**
 * Single meme/submission thumbnail — used by both `WebSubmissionPicker` (own-meme submission)
 * and the evaluated-results grids on `DuelDetailScreen`/`ChallengeDetailScreen`. Vaporwave/
 * Luminous equivalent of the retired independent-theme `WebSubmissionThumb`, carrying forward its
 * one deliberate rule unchanged: the CALMEST surface in this whole tree — plain `border`, no
 * glow, no brand-color fill — so the meme content stays the visual focus while energy stays on
 * chrome/CTAs/badges around it, not on the memes themselves.
 */
export function WebSubmissionThumb({ imageUrl, caption, onPress, disabled, footerLabel }: WebSubmissionThumbProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  const content = (
    <>
      <Image source={{ uri: imageUrl }} style={[styles.image, { borderColor: colors.border, borderRadius: radius.chip }]} contentFit="cover" />
      {footerLabel ? (
        <Text style={[type.meta, styles.footer, { color: colors.foregroundMuted }]} numberOfLines={1}>
          {footerLabel}
        </Text>
      ) : null}
      {caption ? (
        <Text style={[type.meta, styles.footer, { color: colors.foregroundMuted }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.wrap}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={footerLabel ?? 'Meme submission'}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        styles.wrap,
        disabled && styles.disabled,
        hovered && !disabled && styles.hovered,
        focused && !disabled && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 2, borderRadius: radius.chip },
      ]}>
      {content}
    </Pressable>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    wrap: {
      width: 92,
      marginRight: spacing.md,
    },
    image: {
      width: 92,
      height: 92,
      borderWidth: 1,
    },
    footer: {
      marginTop: 4,
    },
    disabled: {
      opacity: 0.4,
    },
    hovered: {
      opacity: 0.85,
    },
  });
