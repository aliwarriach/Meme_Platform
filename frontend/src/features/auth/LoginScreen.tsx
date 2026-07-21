import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';

import { AuthTextField } from '@/features/auth/components/AuthTextField';
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
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-1 justify-center px-6">
        <Text className="mb-1 text-3xl font-extrabold text-neutral-900 dark:text-white">
          Welcome back
        </Text>
        <Text className="mb-8 text-base text-neutral-500 dark:text-neutral-400">
          Log in to keep posting to your communities.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AuthTextField
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
            <AuthTextField
              label="Password"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        {loginMutation.isError ? (
          <Text className="mb-4 text-sm text-red-500">{loginMutation.error.message}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={loginMutation.isPending}
          className="items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
          <Text className="text-base font-bold text-white">
            {loginMutation.isPending ? 'Logging in…' : 'Log in'}
          </Text>
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">Don&apos;t have an account? </Text>
          <Link href="/register" className="font-semibold text-orange-500">
            Sign up
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
