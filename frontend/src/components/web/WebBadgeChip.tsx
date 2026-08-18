import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_RADIUS, PROFILE_WEB_SPACING, PROFILE_WEB_TYPE } from '@/constants/webProfileTheme';

interface WebBadgeChipProps {
  label: string;
  points: number;
}

/** Solid gold-fill badge chip, not a tinted-background + colored-text chip — per the voting-web
 * accessibility audit this palette is built on, gold-as-text-on-tint measured under 4.5:1 AA, so
 * every badge/rank chip across this palette family uses a solid fill + `onGold` text instead
 * (same structural decision `voting-web.md` documents for its own top-3 rank badge). */
export default function WebBadgeChip({ label, points }: WebBadgeChipProps) {
  const { colors } = useProfileWebTheme();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.gold, borderRadius: PROFILE_WEB_RADIUS.pill },
      ]}>
      <MaterialIcons name="emoji-events" size={16} color={colors.onGold} />
      <Text style={[PROFILE_WEB_TYPE.meta, { color: colors.onGold }]}>
        {label} · +{points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PROFILE_WEB_SPACING.xs,
    paddingHorizontal: PROFILE_WEB_SPACING.md,
    paddingVertical: PROFILE_WEB_SPACING.sm,
  },
});
