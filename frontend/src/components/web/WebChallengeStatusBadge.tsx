import { StyleSheet, Text, View } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_RADIUS, COMPETE_WEB_SHADOW, COMPETE_WEB_SPACING, COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';
import type { ChallengeStatus } from '@/services/challenges';

interface WebChallengeStatusBadgeProps {
  status: ChallengeStatus;
  /** Renders the outline+hard-shadow emphasis treatment — reserved for `active` in list
   * contexts (CompeteScreen), off by default elsewhere (detail screens already carry their own
   * emphasis via the surrounding layout). */
  emphasize?: boolean;
}

/**
 * Centralizes the `STATUS_STYLES` map that was previously copy-pasted three times (native
 * `ChallengeRow`, `ChallengeDetailScreen`, `DuelDetailScreen`) — same status→color mapping and
 * "Pending" label for `setup`, no informational change, just one source of truth. See
 * compete-web.md's "UX improvements" #2 for the emphasis-treatment reasoning.
 */
export function WebChallengeStatusBadge({ status, emphasize = false }: WebChallengeStatusBadgeProps) {
  const { colors } = useCompeteWebTheme();

  const fill = status === 'active' ? colors.primary : status === 'evaluated' ? colors.accent : colors.elevated;
  const onFill = status === 'active' ? colors.onPrimary : status === 'evaluated' ? colors.onAccent : colors.cardForeground;
  const label = status === 'setup' ? 'Pending' : status;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: fill },
        emphasize && status === 'active'
          ? { borderWidth: 2, borderColor: colors.outline, ...COMPETE_WEB_SHADOW.hard }
          : null,
      ]}>
      <Text style={[COMPETE_WEB_TYPE.label, { color: onFill }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: COMPETE_WEB_RADIUS.pill,
    paddingHorizontal: COMPETE_WEB_SPACING.md,
    paddingVertical: 4,
  },
});
