import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { StandingContent, WinnerResponse } from '@/services/competitions';

interface WebWinnerBannerProps {
  winner: WinnerResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  label: string;
  onPress: (content: StandingContent) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Vaporwave/Luminous equivalent of the retired independent-theme `WebWinnerBanner` — this is
 * still the one place this screen concentrates the most energy (a real, content-driven choice:
 * it's the single "decided, celebratory" moment on the page, versus the live/still-changing
 * standings list below it), now expressed through this system's own electric-cyan glow + glass
 * panel language instead of a gold trophy treatment.
 *
 * Trophy badge fill is `indigoSecondary` (not `indigoPrimary`) for the same reason as
 * `WebVotingTabs`/`WebStandingRow`: cyan fails as a white-icon fill in both modes. The glow itself
 * (`indigoGlow`, a pre-alpha'd rgba token) is decorative shadow, not text/icon content, so it's
 * exempt from the 3:1/4.5:1 checks that gated every other color choice here — it's allowed to stay
 * `indigoPrimary`-hued because nothing needs to read it as foreground content.
 */
export function WebWinnerBanner({ winner, isLoading, isError, errorMessage, label, onPress }: WebWinnerBannerProps) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  const content = winner?.content;
  const imageUrl = content?.kind === 'container' ? content.container.thumbnail_url : content?.meme.image_url;
  const authorName =
    content?.kind === 'container' ? content.container.submitter.username : content?.meme.author.username;
  const caption = content?.kind === 'container' ? content.container.title : content?.meme.caption;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.trophyBadge}>
          <MaterialIcons name="emoji-events" size={16} color={colors.onAccent} />
        </View>
        <Text style={[type.label, { color: colors.foreground }]}>{label}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerPad}>
          <ActivityIndicator size="small" color={colors.foregroundMuted} />
        </View>
      ) : isError ? (
        <Text style={[type.body, { color: colors.foregroundMuted }]}>{errorMessage ?? "Couldn't load the winner."}</Text>
      ) : !content ? (
        <Text style={[type.body, { color: colors.foregroundMuted }]}>No votes were cast in that period.</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open winning entry by ${authorName}`}
          onPress={() => onPress(content)}
          style={({ hovered }: WebPressableState) => [styles.entryRow, hovered && styles.entryRowHovered]}>
          <Text style={[type.display, { color: colors.foreground }]}>1</Text>

          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <MaterialIcons name="camera-alt" size={18} color={colors.foregroundMuted} />
            </View>
          )}

          <View style={styles.entryText}>
            <Text style={[type.title, { color: colors.foreground }]} numberOfLines={1}>
              {authorName}
            </Text>
            {caption ? (
              <Text style={[type.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
            <Text style={[type.meta, styles.scoreText, { color: colors.foregroundMuted }]}>score {winner.score}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      shadowColor: colors.indigoGlow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 20,
      elevation: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    trophyBadge: {
      height: 26,
      width: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.indigoSecondary,
    },
    centerPad: {
      paddingVertical: spacing.sm,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.chip,
    },
    entryRowHovered: {
      backgroundColor: colors.hoverTint,
    },
    thumb: {
      height: 56,
      width: 56,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
    },
    thumbFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    entryText: {
      flex: 1,
      gap: 2,
    },
    scoreText: {
      marginTop: 2,
    },
  });
