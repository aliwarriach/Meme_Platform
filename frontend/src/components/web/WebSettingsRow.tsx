import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_RADIUS, PROFILE_WEB_SPACING, PROFILE_WEB_TYPE, type WebPressableState } from '@/constants/webProfileTheme';

interface WebSettingsRowProps {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  /** Danger-zone rows (Log Out) render in `destructive` instead of `foreground`/`primary` — a
   * second, non-color-only cue (icon + right-aligned label + no chevron) also distinguishes it,
   * per the accessibility rule that color is never the only signal. */
  destructive?: boolean;
}

/** Settings-list row — 52px min height (comfortably above the 44px touch-target floor, with the
 * `Touch Spacing` guideline's 8px minimum gap applied via the list's own `gap`), full row is the
 * hit target rather than just the label. Reused for both nav-entry links (Friends, Communities,
 * Compete, Voting, Inbox) and destructive actions (Log Out), keeping one consistent settings-row
 * pattern instead of two different visual languages for what is structurally the same kind of
 * row. */
export default function WebSettingsRow({ label, icon, onPress, destructive = false }: WebSettingsRowProps) {
  const { colors } = useProfileWebTheme();
  const tint = destructive ? colors.destructive : colors.primaryText;
  const textColor = destructive ? colors.destructive : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, focused }: WebPressableState) => [
        styles.root,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: PROFILE_WEB_RADIUS.card },
        hovered && { backgroundColor: colors.elevatedHover },
        focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: -2 },
      ]}>
      <View style={styles.left}>
        <MaterialIcons name={icon} size={20} color={tint} />
        <Text style={[PROFILE_WEB_TYPE.title, { color: textColor }]}>{label}</Text>
      </View>
      {destructive ? null : <MaterialIcons name="chevron-right" size={20} color={colors.foregroundMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: PROFILE_WEB_SPACING.lg,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PROFILE_WEB_SPACING.md,
  },
});
