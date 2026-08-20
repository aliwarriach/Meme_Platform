import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { StandingContent, StandingEntryResponse } from '@/services/competitions';

interface WebStandingRowProps {
  entry: StandingEntryResponse;
  onPress: (content: StandingContent) => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Vaporwave/Luminous equivalent of the retired independent-theme `WebStandingRow`. Preserves the
 * one genuine UX addition that theme made over the native `StandingRow` (a real, not decorative,
 * finding — kept because it's still true under the new visual system): ranks 1-3 get a filled
 * badge chip so scanning "who's currently doing well" is faster than the native row, which
 * renders every rank identically. Ranks 4+ stay visually quiet (muted numeral, no chip) so the
 * top of the list keeps priority.
 *
 * Top-3 badge is a solid `indigoSecondary` fill + `onAccent` text (not `indigoPrimary`, and not a
 * low-alpha tint) — same contrast reasoning as `WebVotingTabs`: cyan fails as a white-text fill in
 * both modes, and a tinted background reintroduces exactly the under-4.5:1 risk the prior voting
 * system's own audit found with tinted gold. Score text stays `foreground` (not brand-colored) in
 * every row — differentiation is carried by the badge and a bolder weight for top-3, not by
 * color-as-the-only-signal on the number itself.
 */
export function WebStandingRow({ entry, onPress }: WebStandingRowProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  const { content } = entry;
  const isContainer = content.kind === 'container';
  const imageUrl = isContainer ? content.container.thumbnail_url : content.meme.image_url;
  const authorName = isContainer ? content.container.submitter.username : content.meme.author.username;
  const caption = isContainer ? content.container.title : content.meme.caption;
  const isTopThree = entry.rank <= 3;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank}, meme by ${authorName}, score ${entry.score}`}
      onPress={() => onPress(content)}
      style={({ hovered, focused }: WebPressableState) => [
        styles.row,
        hovered && { backgroundColor: colors.surfaceHover },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <View style={[styles.rankWrap, isTopThree && { backgroundColor: colors.indigoSecondary }]}>
        <Text style={[type.title, { color: isTopThree ? colors.onAccent : colors.foregroundMuted }]}>
          {entry.rank}
        </Text>
      </View>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <MaterialIcons name="camera-alt" size={16} color={colors.foregroundMuted} />
        </View>
      )}

      <View style={styles.textWrap}>
        <Text style={[type.title, { color: colors.foreground }]} numberOfLines={1}>
          {authorName}
        </Text>
        {caption ? (
          <Text style={[type.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>

      <Text style={[isTopThree ? type.h2 : type.title, { color: colors.foreground, fontSize: isTopThree ? 18 : 15 }]}>
        {entry.score}
      </Text>
    </Pressable>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    rankWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: radius.chip,
    },
    thumbFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    textWrap: {
      flex: 1,
      gap: 1,
    },
  });
