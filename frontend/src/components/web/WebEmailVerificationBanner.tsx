import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDispatch } from 'react-redux';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { useConfirmEmailOtpMutation, useRequestEmailOtpMutation } from '@/services/useEmailVerification';
import { setEmailVerified } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Net-new for this migration — a real Phase 2 finding, not a visual reskin. Neither the retired
 * independent-theme `SessionScreen.web.tsx` nor `pages/profile-web.md` ever rendered native's
 * `EmailVerificationBanner` — the web build has silently dropped it since this screen's very first
 * web pass. An unverified account can't vote, generate AI captions, start new DMs, or create a
 * community (`.claude/memory/hardening.md` F-1), and Profile is "the only place in the app that
 * explains why and lets the user actually fix it" (native's own doc comment) — so a web user with
 * an unverified email currently hits those gates with zero on-screen explanation or fix path.
 * Additive only: no new backend call, reuses the exact mutations/Redux action native's banner
 * already uses (`useRequestEmailOtpMutation`, `useConfirmEmailOtpMutation`, `setEmailVerified`) —
 * just Vaporwave-styled markup instead of native's NativeWind classNames (which pull the "Vivid
 * Meme Culture" native tokens, not Vaporwave, so reusing that component verbatim on web would
 * contradict this screen's own token migration).
 */
export function WebEmailVerificationBanner() {
  const dispatch = useDispatch<AppDispatch>();
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState('');
  const requestOtp = useRequestEmailOtpMutation();
  const confirmOtp = useConfirmEmailOtpMutation();

  const onRequestCode = () => {
    requestOtp.mutate(undefined, { onSuccess: () => setCodeRequested(true) });
  };

  const onConfirm = () => {
    confirmOtp.mutate(code, {
      onSuccess: () => dispatch(setEmailVerified(new Date().toISOString())),
    });
  };

  return (
    <View style={styles.root}>
      <Text style={[type.title, { color: colors.foreground }]}>Verify your email</Text>
      <Text style={[type.meta, styles.body, { color: colors.foregroundMuted }]}>
        Voting, AI captions, starting new chats, and creating communities all require a verified
        email.
      </Text>

      {!codeRequested ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send verification code"
          onPress={onRequestCode}
          disabled={requestOtp.isPending}
          style={({ hovered, focused }: WebPressableState) => [
            styles.button,
            hovered && !requestOtp.isPending && styles.buttonHovered,
            requestOtp.isPending && styles.buttonDisabled,
            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 2 },
          ]}>
          {requestOtp.isPending ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[type.title, { color: colors.onAccent }]}>Send verification code</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.confirmWrap}>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            placeholderTextColor={colors.foregroundMuted}
            accessibilityLabel="6-digit verification code"
            style={[
              type.body,
              styles.input,
              { color: colors.foreground, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          />
          {confirmOtp.isError ? (
            <Text style={[type.meta, { color: colors.error, marginTop: spacing.xs }]}>{confirmOtp.error.message}</Text>
          ) : null}
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm code"
              onPress={onConfirm}
              disabled={confirmOtp.isPending || code.length !== 6}
              style={({ hovered, focused }: WebPressableState) => [
                styles.button,
                styles.buttonFlex,
                hovered && !(confirmOtp.isPending || code.length !== 6) && styles.buttonHovered,
                (confirmOtp.isPending || code.length !== 6) && styles.buttonDisabled,
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 2 },
              ]}>
              {confirmOtp.isPending ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={[type.title, { color: colors.onAccent }]}>Confirm</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
              onPress={onRequestCode}
              disabled={requestOtp.isPending}
              style={({ hovered, focused }: WebPressableState) => [
                styles.outlineButton,
                { borderColor: ringColor },
                hovered && !requestOtp.isPending && { backgroundColor: colors.hoverTint },
                requestOtp.isPending && styles.buttonDisabled,
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 2 },
              ]}>
              <Text style={[type.title, { color: ringColor }]}>Resend</Text>
            </Pressable>
          </View>
        </View>
      )}

      {requestOtp.isError ? (
        <Text style={[type.meta, { color: colors.error, marginTop: spacing.sm }]}>{requestOtp.error.message}</Text>
      ) : null}
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
      borderWidth: 1,
      borderColor: colors.indigoSecondary,
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.card,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    body: {
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    button: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.indigoSecondary,
      paddingHorizontal: spacing.lg,
    },
    buttonFlex: {
      flex: 1,
    },
    buttonHovered: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    outlineButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing.lg,
    },
    confirmWrap: {
      marginTop: spacing.xs,
    },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderRadius: radius.chip,
      paddingHorizontal: spacing.md,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
