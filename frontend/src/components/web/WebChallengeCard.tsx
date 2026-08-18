import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SHADOW, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE, type WebPressableState } from '@/constants/webCompeteTheme';
import { WebChallengeStatusBadge } from '@/components/web/WebChallengeStatusBadge';
import type { ChallengeResponse } from '@/services/challenges';

interface WebChallengeCardProps {
  challenge: ChallengeResponse;
  onPress: () => void;
}

/**
 * Replaces native `components/ChallengeRow.tsx` for `CompeteScreen.web.tsx`'s
 * Active/Open-to-join/Results lists. `active` challenges get this page's outline+hard-shadow
 * emphasis treatment so a live challenge visibly outranks a pending/evaluated one in the same
 * stacked list — a real scan-priority gap on the native screen (see compete-web.md's "UX
 * improvements" #2). Meme content itself never appears on this row, so no calm-vs-loud tradeoff
 * applies here — this row IS chrome.
 */
export function WebChallengeCard({ challenge, onPress }: WebChallengeCardProps) {
  const { colors } = useCompeteWebTheme();
  const isActive = challenge.status === 'active';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open challenge ${challenge.title}`}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
        isActive && { borderWidth: 2, borderColor: colors.outline, ...COMPETE_WEB_SHADOW.hard },
        hovered && { backgroundColor: colors.elevatedHover },
        focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <View style={styles.textWrap}>
        <Text style={[COMPETE_WEB_TYPE.cardTitle, { color: colors.cardForeground }]} numberOfLines={1}>
          {challenge.title}
        </Text>
        <Text style={[COMPETE_WEB_TYPE.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
          {challenge.sides.map((s) => s.name).join(' vs ')}
        </Text>
      </View>
      <WebChallengeStatusBadge status={challenge.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: COMPETE_WEB_SPACING.md,
    borderRadius: COMPETE_WEB_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: COMPETE_WEB_SPACING.md,
    paddingVertical: COMPETE_WEB_SPACING.md,
    marginBottom: COMPETE_WEB_SPACING.sm,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
});
