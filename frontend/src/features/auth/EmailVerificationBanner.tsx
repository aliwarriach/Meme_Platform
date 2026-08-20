import { useState } from 'react';
import { Text, View } from 'react-native';
import { useDispatch } from 'react-redux';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { useConfirmEmailOtpMutation, useRequestEmailOtpMutation } from '@/services/useEmailVerification';
import { setEmailVerified } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

/**
 * Shown on the profile screen while the signed-in user's email is unverified — an
 * unverified account can't vote, generate AI captions, start new DMs, or create a
 * community (SecurityFeatures.md F-1), so this is the only place in the app that
 * explains why and lets the user actually fix it.
 */
export function EmailVerificationBanner() {
  const dispatch = useDispatch<AppDispatch>();
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
    <View className="mb-6 rounded-card border border-primary/40 bg-primary/10 p-4">
      <Text className="font-title text-sm text-heading">Verify your email</Text>
      <Text className="mt-1 font-body text-xs text-ink-muted">
        Voting, AI captions, starting new chats, and creating communities all require a
        verified email.
      </Text>

      {!codeRequested ? (
        <PillButton
          label="Send verification code"
          onPress={onRequestCode}
          loading={requestOtp.isPending}
          className="mt-3"
        />
      ) : (
        <View className="mt-3">
          <TextField
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            error={confirmOtp.isError ? confirmOtp.error.message : undefined}
          />
          <View className="flex-row gap-2">
            <PillButton
              label="Confirm"
              onPress={onConfirm}
              loading={confirmOtp.isPending}
              disabled={code.length !== 6}
              className="flex-1"
            />
            <PillButton
              label="Resend"
              variant="outline"
              onPress={onRequestCode}
              loading={requestOtp.isPending}
            />
          </View>
        </View>
      )}
      {requestOtp.isError ? (
        <Text className="mt-2 font-body text-xs text-error">{requestOtp.error.message}</Text>
      ) : null}
    </View>
  );
}
