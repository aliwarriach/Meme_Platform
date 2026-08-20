import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useSendMessageMutation } from '@/services/useMessaging';

const MAX_MESSAGE_LENGTH = 2000;

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Themed equivalent of native `ThreadScreen`'s inline `Composer` — same optimistic-send flow
 * (`useSendMessageMutation`, cleared immediately on submit since the optimistic bubble already
 * renders it), new Vaporwave/Luminous chrome. No `KeyboardAvoidingView` — that's an iOS-only
 * concern (native's own `Platform.OS === 'ios'` branch), meaningless on a web `<textarea>`.
 */
export default function WebMessageComposer({ conversationId }: { conversationId: string }) {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const [draft, setDraft] = useState('');
  const sendMessage = useSendMessageMutation(conversationId);
  const trimmed = draft.trim();

  const onSend = () => {
    if (!trimmed) return;
    setDraft('');
    sendMessage.mutate({ kind: 'text', body: trimmed });
  };

  return (
    <View style={styles.root}>
      {sendMessage.isError ? <Text style={[type.meta, styles.errorText]}>{sendMessage.error.message}</Text> : null}
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.foregroundMuted}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Message text"
          onSubmitEditing={onSend}
          style={[type.body, styles.input]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={onSend}
          disabled={!trimmed}
          style={({ hovered, focused }: WebPressableState) => [
            styles.sendButton,
            !trimmed && styles.disabled,
            hovered && !!trimmed && styles.sendButtonHovered,
            focused && { outlineColor: colors.indigoSecondary, outlineWidth: 2, outlineOffset: 1 },
          ]}>
          <Text style={[type.title, styles.sendLabel]}>Send</Text>
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
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      maxHeight: 112,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.foreground,
      backgroundColor: colors.surfaceGlass,
    },
    sendButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.indigoSecondary,
    },
    sendButtonHovered: {
      opacity: 0.9,
    },
    sendLabel: {
      color: colors.onAccent,
    },
    disabled: {
      opacity: 0.4,
    },
    errorText: {
      color: colors.error,
      marginBottom: spacing.xs,
    },
  });
