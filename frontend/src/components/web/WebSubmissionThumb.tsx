import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';

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
 * and the evaluated-results grids on `DuelDetailScreen`/`ChallengeDetailScreen`. Deliberately
 * the CALMEST surface in this whole system: plain `border` (never `outline`), no hard shadow, no
 * brand-color fill — per the brief's explicit instruction that meme content stays the visual
 * focus while energy lives in chrome/CTAs/badges around it, not on the memes themselves.
 */
export function WebSubmissionThumb({ imageUrl, caption, onPress, disabled, footerLabel }: WebSubmissionThumbProps) {
  const { colors } = useCompeteWebTheme();

  const content = (
    <>
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { borderColor: colors.border, borderRadius: COMPETE_WEB_RADIUS.chip }]}
        contentFit="cover"
      />
      {footerLabel ? (
        <Text style={[COMPETE_WEB_TYPE.meta, styles.footer, { color: colors.foregroundMuted }]} numberOfLines={1}>
          {footerLabel}
        </Text>
      ) : null}
      {caption ? (
        <Text style={[COMPETE_WEB_TYPE.meta, styles.footer, { color: colors.foregroundMuted }]} numberOfLines={1}>
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
      style={({ hovered, focused }: WebPressableState) => [
        styles.wrap,
        disabled && styles.disabled,
        hovered && !disabled && styles.hovered,
        focused && !disabled && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2, borderRadius: COMPETE_WEB_RADIUS.chip },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 92,
    marginRight: COMPETE_WEB_SPACING.md,
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
