import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import {
  forgotPasswordRequestSchema,
  resetPasswordConfirmSchema,
  type ForgotPasswordRequestFormValues,
  type ResetPasswordConfirmFormValues,
} from '@/features/auth/schemas';
import {
  usePasswordResetConfirmMutation,
  usePasswordResetRequestMutation,
} from '@/services/useAuth';

type Step = 'request' | 'confirm';

/**
 * Password recovery — two steps, no session/Redux involvement anywhere here (nothing is
 * authenticated until the user logs in again with the new password on `/login`).
 * Step 1 always shows the same "if that email is registered…" copy regardless of whether
 * the account exists (`services/auth.ts::passwordResetRequestRequest`'s own doc comment) —
 * never branch UI on account existence here.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');

  const requestMutation = usePasswordResetRequestMutation();
  const confirmMutation = usePasswordResetConfirmMutation();

  const requestForm = useForm<ForgotPasswordRequestFormValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const confirmForm = useForm<ResetPasswordConfirmFormValues>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  const onRequestSubmit = requestForm.handleSubmit(async (values) => {
    await requestMutation.mutateAsync({ email: values.email });
    setEmail(values.email);
    setStep('confirm');
  });

  const onResend = () => {
    if (!email) return;
    requestMutation.mutate({ email });
  };

  const onConfirmSubmit = confirmForm.handleSubmit(async (values) => {
    try {
      await confirmMutation.mutateAsync({
        email,
        code: values.code,
        new_password: values.newPassword,
      });
      router.replace('/login');
    } catch {
      // surfaced inline via confirmMutation.isError/error below
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Reset password" showBack />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled">
        <View className="px-6 py-10">
          {step === 'request' ? (
            <>
              <Text className="mb-1 text-center font-heading text-2xl text-heading">
                Forgot your password?
              </Text>
              <Text className="mb-8 text-center font-body text-base text-ink-muted">
                Enter the email on your account. If it&apos;s registered, we&apos;ll send a
                6-digit code to reset your password.
              </Text>

              <Controller
                control={requestForm.control}
                name="email"
                render={({ field }) => (
                  <TextField
                    label="Email"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="username"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={requestForm.formState.errors.email?.message}
                  />
                )}
              />

              {requestMutation.isError ? (
                <Text className="mb-4 font-body text-sm text-error">
                  {requestMutation.error.message}
                </Text>
              ) : null}

              <PillButton
                label={requestMutation.isPending ? 'Sending…' : 'Send reset code'}
                onPress={onRequestSubmit}
                loading={requestMutation.isPending}
              />
            </>
          ) : (
            <>
              <Text className="mb-1 text-center font-heading text-2xl text-heading">
                Check your email
              </Text>
              <Text className="mb-8 text-center font-body text-base text-ink-muted">
                If {email} is registered, a 6-digit code is on its way. Enter it below with
                your new password.
              </Text>

              <Controller
                control={confirmForm.control}
                name="code"
                render={({ field }) => (
                  <TextField
                    label="6-digit code"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={field.value}
                    onChangeText={field.onChange}
                    error={confirmForm.formState.errors.code?.message}
                  />
                )}
              />
              <Controller
                control={confirmForm.control}
                name="newPassword"
                render={({ field }) => (
                  <TextField
                    label="New password"
                    secureTextEntry
                    textContentType="newPassword"
                    autoComplete="password-new"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={confirmForm.formState.errors.newPassword?.message}
                  />
                )}
              />
              <Controller
                control={confirmForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <TextField
                    label="Confirm new password"
                    secureTextEntry
                    textContentType="newPassword"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={confirmForm.formState.errors.confirmPassword?.message}
                  />
                )}
              />

              {confirmMutation.isError ? (
                <Text className="mb-4 font-body text-sm text-error">
                  {confirmMutation.error.message}
                </Text>
              ) : null}

              <PillButton
                label={confirmMutation.isPending ? 'Resetting…' : 'Reset password'}
                onPress={onConfirmSubmit}
                loading={confirmMutation.isPending}
              />

              <PillButton
                label={requestMutation.isPending ? 'Sending…' : 'Resend code'}
                variant="ghost"
                onPress={onResend}
                loading={requestMutation.isPending}
                className="mt-3"
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
