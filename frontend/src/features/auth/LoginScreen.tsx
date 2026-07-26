import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
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
      <View className="flex-1 justify-center px-6">
        <Text className="mb-1 text-center font-heading text-3xl text-heading">MemeVerse</Text>
        <Text className="mb-8 text-center font-body text-base text-ink-muted">
          Log in to keep posting to your communities.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label="Email"
              keyboardType="email-address"
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
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        {loginMutation.isError ? (
          <Text className="mb-4 font-body text-sm text-error">{loginMutation.error.message}</Text>
        ) : null}

        <PillButton
          label={loginMutation.isPending ? 'Logging in…' : 'Log In'}
          onPress={onSubmit}
          loading={loginMutation.isPending}
        />

        <View className="mt-6 flex-row justify-center">
          <Text className="font-body text-ink-muted">Don&apos;t have an account? </Text>
          <Link href="/register" className="font-title text-primary-dim">
            Register
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
