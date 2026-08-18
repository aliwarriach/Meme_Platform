import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_RADIUS, PROFILE_WEB_SPACING, PROFILE_WEB_TYPE } from '@/constants/webProfileTheme';

interface WebScoreCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  accentColor?: string;
}

/** Single stat card (Meme Score, badge count) — a Meme Score hero number deserves more visual
 * weight than the native screen's plain centered text block, since it's the single most
 * scannable proof of standing on this screen (grounded in the audit's "returning core user"
 * lens: a member checks their score before anything else). Uses `PROFILE_WEB_TYPE.stat` (34px
 * Anton), a size not present in the native version, sized between voting-web's `display` (26px)
 * and this screen's own need for a larger hero digit. */
export default function WebScoreCard({ label, value, isLoading, accentColor }: WebScoreCardProps) {
  const { colors } = useProfileWebTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: PROFILE_WEB_RADIUS.card }]}>
      <Text style={[PROFILE_WEB_TYPE.label, { color: colors.foregroundMuted }]}>{label}</Text>
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
      ) : (
        <Text style={[PROFILE_WEB_TYPE.stat, { color: accentColor ?? colors.foreground, marginTop: PROFILE_WEB_SPACING.xs }]}>
          {value ?? 0}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: PROFILE_WEB_SPACING.xl,
    paddingHorizontal: PROFILE_WEB_SPACING.lg,
  },
  spinner: {
    marginTop: PROFILE_WEB_SPACING.sm,
  },
});
