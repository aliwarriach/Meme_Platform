import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useVotingWebTheme } from '@/constants/VotingWebTheme';
import { VOTING_WEB_SPACING, VOTING_WEB_TYPE, type WebPressableState } from '@/constants/webVotingTheme';

interface WebVotingTopBarProps {
  title: string;
}

/** Per-page header for the voting web screen — back button + title + a light/dark toggle.
 * Rebuilds the native `TopBar`'s data/behavior with new chrome, since that component is
 * native-resolved and aliases the old token set (same precedent as `WebCommunityTopBar`/
 * `WebFeedTopBar`, built independently rather than imported — see scope boundary note in
 * `webVotingTheme.ts`). No bottom-nav destination exists for this screen (Voting is reached via
 * the desktop sidebar or an in-app menu link, not a `FloatingBottomNav` tab) so, matching the
 * native screen's own navigation model, this bar's back button is the only way back on narrow
 * viewports — intentionally no `FloatingBottomNav` mounted here. */
export default function WebVotingTopBar({ title }: WebVotingTopBarProps) {
  const router = useRouter();
  const { mode, colors, toggleMode } = useVotingWebTheme();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ hovered, focused }: WebPressableState) => [
            styles.iconButton,
            hovered && { backgroundColor: colors.elevatedHover },
            focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <Text style={[VOTING_WEB_TYPE.h2, styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleMode}
          style={({ hovered, focused }: WebPressableState) => [
            styles.iconButton,
            { backgroundColor: colors.elevated },
            hovered && { backgroundColor: colors.elevatedHover },
            focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: VOTING_WEB_SPACING.lg,
    paddingVertical: VOTING_WEB_SPACING.lg,
    borderBottomWidth: 1,
  },
  left: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconButton: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
