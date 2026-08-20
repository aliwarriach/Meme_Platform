import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebCompeteTopBarProps {
  title: string;
  /** Only `CompeteScreen` (the list root) has no "back" — every drill-in/form screen does. */
  showBack?: boolean;
  rightAction?: ReactNode;
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime — see the same local-copy precedent every Vaporwave component in this app follows
 * (`WebVotingTopBar`, `WebStandingRow`, etc. each keep their own copy rather than importing one). */
interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Per-page header for the Compete/Challenges web screens — back button (optional) + title + the
 * Vaporwave/Luminous light-dark toggle + an optional extra action slot (e.g. `CompeteScreen`'s
 * "start open challenge" button). Migrated off the retired independent `webCompeteTheme.ts`/
 * `CompeteWebTheme.tsx` Neubrutalism system onto the project-standard Vaporwave/Luminous glass
 * system — see `design-system/meme-platform/pages/compete-web.md` for the migration record.
 * Same shape as `WebVotingTopBar`/`WebFriendsTopBar` (back + title + toggle), extended with the
 * `showBack`/`rightAction` props this six-screen tree already needed pre-migration.
 */
export default function WebCompeteTopBar({ title, showBack = true, rightAction }: WebCompeteTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  // Mode-conditional accent, same reasoning as every other Vaporwave web screen: indigoPrimary
  // (bright cyan) measures ~11.7:1 against the dark canvas but only ~1.7:1 against the light
  // canvas; indigoSecondary (magenta) is the inverse (~6.5:1 light, too-close-in-luminance dark).
  // Picking whichever token actually clears 3:1/4.5:1 in the active mode, not eyeballed.
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ hovered, focused }: WebPressableState) => [
              styles.iconButton,
              hovered && styles.iconButtonHovered,
              focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
            ]}>
            <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[type.h2, styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {rightAction}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleMode}
          style={({ hovered, focused }: WebPressableState) => [
            styles.iconButton,
            hovered && styles.iconButtonHovered,
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
        </Pressable>
      </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      gap: spacing.sm,
    },
    iconButton: {
      height: 40,
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    iconButtonHovered: {
      backgroundColor: colors.hoverTint,
    },
  });
