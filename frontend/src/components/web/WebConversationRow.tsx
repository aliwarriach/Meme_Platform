import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { ConversationResponse, MessageResponse } from '@/services/messaging';
import { timeAgo } from '@/utils/timeAgo';

interface WebConversationRowProps {
  conversation: ConversationResponse;
}

function previewOf(message: MessageResponse | null): string {
  if (!message) return 'No messages yet';
  if (message.kind === 'meme') return '📷 Meme';
  return message.body ?? '';
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Themed equivalent of native `ConversationList`'s `ConversationRow` — same data/navigation
 * (`router.push('/inbox/[conversationId]')`, unchanged target, unchanged query hooks), new
 * Vaporwave/Luminous chrome. Not a reskin of the shared native row (that file, and the
 * `ConversationList` wrapper around it, stay untouched — this is a standalone equivalent
 * scoped to the full web inbox tree, same "new Web* component, not a reskinned native one"
 * precedent every prior Vaporwave screen's rows follow).
 */
export function WebConversationRow({ conversation }: WebConversationRowProps) {
  const router = useRouter();
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const hasUnread = conversation.unread_count > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${conversation.other_user.username}${
        hasUnread ? `, ${conversation.unread_count} unread` : ''
      }`}
      onPress={() =>
        router.push({ pathname: '/inbox/[conversationId]', params: { conversationId: conversation.id } })
      }
      style={({ hovered, focused }: WebPressableState) => [
        styles.row,
        hovered && styles.rowHovered,
        focused && { outlineColor: colors.indigoSecondary, outlineWidth: 2, outlineOffset: -2 },
      ]}>
      <WebAvatar username={conversation.other_user.username} size={44} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[type.title, styles.username]} numberOfLines={1}>
            {conversation.other_user.username}
          </Text>
          {conversation.last_message_at ? (
            <Text style={[type.meta, styles.time]}>{timeAgo(conversation.last_message_at)}</Text>
          ) : null}
        </View>

        <View style={styles.bottomLine}>
          <Text style={[type.body, hasUnread ? styles.previewUnread : styles.previewRead]} numberOfLines={1}>
            {previewOf(conversation.last_message)}
          </Text>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={[type.label, styles.badgeLabel]}>{conversation.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowHovered: {
      backgroundColor: colors.surfaceHover,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    topLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    username: {
      color: colors.foreground,
      flexShrink: 1,
    },
    time: {
      color: colors.foregroundMuted,
    },
    bottomLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    previewRead: {
      flex: 1,
      color: colors.foregroundMuted,
    },
    previewUnread: {
      flex: 1,
      color: colors.foreground,
    },
    badge: {
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: 5,
      backgroundColor: colors.indigoSecondary,
    },
    badgeLabel: {
      color: colors.onAccent,
      fontSize: 11,
      textTransform: 'none',
      letterSpacing: 0,
    },
  });
