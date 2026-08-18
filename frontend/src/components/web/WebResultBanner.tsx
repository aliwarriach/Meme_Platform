import { StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SHADOW, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';

interface WebResultBannerProps {
  winnerName: string | null;
}

/**
 * Evaluated-challenge win/tie banner, shared by `DuelDetailScreen`/`ChallengeDetailScreen` (2
 * consumers — extracted per this codebase's own "extract on 2nd occurrence" convention). Carries
 * this page's loudest emphasis treatment (outline + hard shadow, primary fill) per the brief's
 * "energy belongs in... winner states" balance instruction — same reasoning `voting-web.md` used
 * for its own `WebWinnerBanner`.
 */
export function WebResultBanner({ winnerName }: WebResultBannerProps) {
  const { colors } = useCompeteWebTheme();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.primary, borderColor: colors.outline, ...COMPETE_WEB_SHADOW.hard },
      ]}>
      <Text style={[COMPETE_WEB_TYPE.display, styles.text, { color: colors.onPrimary }]}>
        {winnerName ? `🏆 ${winnerName} wins!` : 'Tie — no winner'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: COMPETE_WEB_RADIUS.card,
    borderWidth: 2,
    padding: COMPETE_WEB_SPACING.lg,
    marginBottom: COMPETE_WEB_SPACING.lg,
  },
  text: {
    textAlign: 'center',
  },
});
