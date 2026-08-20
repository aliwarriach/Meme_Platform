import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WebChallengeStatusBadge } from '@/components/web/WebChallengeStatusBadge';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { ChallengeResponse } from '@/services/challenges';

interface WebChallengeCardProps {
  challenge: ChallengeResponse;
  onPress: () => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Replaces native `components/ChallengeRow.tsx` for `CompeteScreen.web.tsx`'s
 * Needs-your-response/Active/Open-to-join/Results lists. Vaporwave/Luminous equivalent of the
 * retired independent-theme `WebChallengeCard` — `active` challenges get a soft `indigoGlow` card
 * shadow (this migration's replacement for the retired system's hard-offset-shadow emphasis
 * device) so a live challenge visibly outranks a pending/evaluated one in the same stacked list —
 * a real scan-priority gap on the native screen (see compete-web.md's history). The glow is
 * decorative shadow, not text/icon content, so it's exempt from contrast rules, same as
 * `WebWinnerBanner`'s glow on Voting.
 */
export function WebChallengeCard({ challenge, onPress }: WebChallengeCardProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(radius, spacing), [radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  const isActive = challenge.status === 'active';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open challenge ${challenge.title}`}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        styles.row,
        { backgroundColor: colors.surfaceGlass, borderColor: colors.border },
        isActive && {
          shadowColor: colors.indigoGlow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 12,
          elevation: 3,
        },
        hovered && { backgroundColor: colors.surfaceHover },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <View style={styles.textWrap}>
        <Text style={[type.title, { color: colors.foreground }]} numberOfLines={1}>
          {challenge.title}
        </Text>
        <Text style={[type.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
          {challenge.sides.map((s) => s.name).join(' vs ')}
        </Text>
      </View>
      <WebChallengeStatusBadge status={challenge.status} emphasize />
    </Pressable>
  );
}

const createStyles = (radius: VaporwaveTheme['radius'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.card,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
  });
