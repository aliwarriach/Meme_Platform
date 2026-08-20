import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebInboxTopBarProps {
  socketStatus: string;
  onNewChat: () => void;
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime — see `WebVotingTopBar`'s identical local copy of this note; kept per-file, not
 * shared, per this codebase's established precedent. */
interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Header for the full `/inbox` conversation-list page — back button + title + live socket
 * status dot + a labeled "New Chat" action + the Vaporwave/Luminous light/dark toggle. Same
 * back-button-only shape as `WebVotingTopBar`/`WebLeaderboardsTopBar` (Inbox isn't in
 * `FloatingBottomNav`'s `NavDestination` union either, so no bottom-nav variant is needed —
 * `DesktopSidebarNav` carries its own "Inbox" link).
 *
 * The "New Chat" action is a labeled pill, not the bare icon-only button native's `InboxScreen`
 * uses (Phase 2 finding: an icon-only compose affordance reads ambiguously on first glance even
 * with an `accessibilityLabel`, and desktop web has the horizontal room mobile doesn't) — see
 * `pages/inbox-web.md`.
 */
export default function WebInboxTopBar({ socketStatus, onNewChat }: WebInboxTopBarProps) {
  const router = useRouter();
  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  // Mode-conditional focus ring — indigoPrimary clears ~11.7:1 against the dark canvas but only
  // ~1.7:1 against light (fails the 3:1 non-text minimum); indigoSecondary is the inverse.
  // Same measured pairing every prior Vaporwave screen's top bar uses.
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;
  // Sourced from theme tokens, not hardcoded hex — no dedicated "warning/pending" role exists
  // in this palette, so "connecting" borrows the brand accent as a neutral in-progress signal
  // rather than inventing an ungrounded amber literal.
  const dotColor =
    socketStatus === 'connected'
      ? colors.accentUpvote
      : socketStatus === 'connecting'
        ? colors.indigoSecondary
        : colors.accentDownvote;

  return (
    <View style={styles.root}>
      <View style={styles.left}>
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
      </View>

      <View style={styles.center}>
        <Text style={[type.h2, styles.title]} numberOfLines={1}>
          Inbox
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[type.meta, styles.statusText]}>{socketStatus}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          onPress={onNewChat}
          style={({ hovered, focused }: WebPressableState) => [
            styles.newChatButton,
            hovered && styles.newChatButtonHovered,
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <MaterialIcons name="add" size={18} color={colors.onAccent} />
          <Text style={[type.title, styles.newChatLabel]}>New Chat</Text>
        </Pressable>

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
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    left: {
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      color: colors.foreground,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    dot: {
      height: 7,
      width: 7,
      borderRadius: 4,
    },
    statusText: {
      color: colors.foregroundMuted,
      textTransform: 'capitalize',
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
    newChatButton: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.indigoSecondary,
    },
    newChatButtonHovered: {
      opacity: 0.9,
    },
    newChatLabel: {
      color: colors.onAccent,
    },
  });
