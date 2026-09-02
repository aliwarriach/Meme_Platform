import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';

import { KeyboardAwareForm } from '@/components/KeyboardAvoidingScreen';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { GoogleSignInFlow } from '@/features/auth/GoogleSignInFlow';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { useLoginMutation } from '@/services/useAuth';
import { persistCredentials } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const loginMutation = useLoginMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await loginMutation.mutateAsync(values);
      // .unwrap() so a session-persistence failure (e.g. secure storage unavailable)
      // throws instead of silently leaving the user stuck on this screen.
      await dispatch(persistCredentials({ token: result.access_token, user: result.user })).unwrap();
      router.replace('/');
    } catch (err) {
      // login itself is surfaced inline via loginMutation.isError/error below; anything
      // else (e.g. persistCredentials failing) still needs to be visible somewhere.
      if (!loginMutation.isError) console.error('[login] could not complete sign-in:', err);
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAwareForm
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="px-6 py-10">
          {/* Decorative brand mark — reuses the same rounded-full + bg-primary-container +
              text-white token combo already established by PillButton/Avatar's initials
              fallback, not a new component or token. Hidden from screen readers since the
              heading text below already names the app/purpose. */}
          <View className="mb-8 items-center">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <Text className="font-heading text-2xl text-white">M</Text>
            </View>
            <Text className="mb-1 text-center font-heading text-3xl text-heading">
              Welcome back
            </Text>
            <Text className="text-center font-body text-base text-ink-muted">
              Log in to keep posting to your communities.
            </Text>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Password"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />

          <View className="-mt-2 mb-4 flex-row justify-end">
            <Link
              href="/forgot-password"
              accessibilityRole="link"
              className="px-1 py-2 font-title text-sm text-primary-dim">
              Forgot password?
            </Link>
          </View>

          {loginMutation.isError ? (
            <Text className="mb-4 font-body text-sm text-error">{loginMutation.error.message}</Text>
          ) : null}

          <PillButton
            label={loginMutation.isPending ? 'Logging in…' : 'Log In'}
            onPress={onSubmit}
            loading={loginMutation.isPending}
          />

          <View className="mt-6 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-outline-variant" />
            <Text className="font-label text-xs uppercase tracking-wide text-ink-muted">or</Text>
            <View className="h-px flex-1 bg-outline-variant" />
          </View>

          <GoogleSignInFlow />

          <View className="mt-6 flex-row justify-center">
            <Text className="font-body text-ink-muted">Don&apos;t have an account? </Text>
            <Link href="/register" className="px-1 py-2 font-title text-primary-dim">
              Register
            </Link>
          </View>
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}
