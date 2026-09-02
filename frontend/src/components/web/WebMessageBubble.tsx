import { format } from 'date-fns';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { MessageResponse } from '@/services/messaging';

interface WebMessageBubbleProps {
  message: MessageResponse;
  isOwn: boolean;
  /** Pending sends have no server row yet — shown dimmed rather than blocking the thread. */
  isPending: boolean;
}

/**
 * Themed equivalent of native `MessageBubble` — same data (text/meme kinds, pending/read state),
 * new Vaporwave/Luminous chrome. Own-vs-other is never signaled by text color alone (this
 * screen's own established rule, same as every prior Vaporwave migration's "no color-coded text"
 * finding): own bubbles get a `surfaceElevated` fill + a full `accentPurple` border, other
 * bubbles get a plain `surfaceGlass` fill with no border — shape + fill differ, not just a tint,
 * and message text itself always stays `foreground`. Purple (not the brand pink `indigoSecondary`
 * every filled element already uses) keeps "this is my bubble" visually distinct from the rest of
 * the system's pink-heavy chrome.
 */
export default function WebMessageBubble({ message, isOwn, isPending }: WebMessageBubbleProps) {
  const router = useRouter();
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, isPending && styles.pending]}>
        {message.kind === 'meme' ? (
          message.meme ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open meme from ${message.sender.username}`}
              disabled={isPending}
              onPress={() => router.push({ pathname: '/memes/[id]', params: { id: message.meme!.id } })}>
              <Image source={{ uri: message.meme.image_url }} style={styles.memeImage} contentFit="cover" />
              {message.meme.caption ? (
                <Text style={[type.body, styles.memeCaption]}>{message.meme.caption}</Text>
              ) : null}
            </Pressable>
          ) : (
            <Text style={[type.body, styles.unavailableText]}>
              {isPending ? 'Sending meme…' : 'This meme is no longer available'}
            </Text>
          )
        ) : (
          <Text style={[type.body, styles.bubbleText]}>{message.body}</Text>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={[type.meta, styles.metaText]}>{format(new Date(message.created_at), 'HH:mm')}</Text>
        {isOwn && !isPending ? (
          <Text style={[type.meta, styles.metaText]}>{message.read_at ? '· Read' : '· Sent'}</Text>
        ) : null}
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
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    rowOwn: {
      alignItems: 'flex-end',
    },
    rowOther: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '70%',
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    bubbleOwn: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.accentPurple,
    },
    bubbleOther: {
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pending: {
      opacity: 0.5,
    },
    bubbleText: {
      color: colors.foreground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    memeImage: {
      width: 220,
      aspectRatio: 4 / 5,
    },
    memeCaption: {
      color: colors.foreground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    unavailableText: {
      color: colors.foregroundMuted,
      fontStyle: 'italic',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingTop: 2,
      paddingHorizontal: 2,
    },
    metaText: {
      color: colors.foregroundMuted,
      fontSize: 11,
    },
  });
