import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';

import { TextField } from '@/components/TextField';
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas';
import { useRegisterMutation } from '@/services/useAuth';
import { persistCredentials } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

export default function RegisterScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const registerMutation = useRegisterMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await registerMutation.mutateAsync(values);
      // .unwrap() so a session-persistence failure (e.g. secure storage unavailable)
      // throws instead of silently leaving the user stuck on this screen.
      await dispatch(persistCredentials({ token: result.access_token, user: result.user })).unwrap();
      router.replace('/');
    } catch (err) {
      // registration itself is surfaced inline via registerMutation.isError/error below;
      // anything else (e.g. persistCredentials failing) still needs to be visible somewhere.
      if (!registerMutation.isError) console.error('[register] could not complete sign-up:', err);
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-1 justify-center px-6">
        <Text className="mb-1 text-3xl font-extrabold text-neutral-900 dark:text-white">
          Create your account
        </Text>
        <Text className="mb-8 text-base text-neutral-500 dark:text-neutral-400">
          Join communities and start posting memes.
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
          name="username"
          render={({ field }) => (
            <TextField
              label="Username"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.username?.message}
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

        {registerMutation.isError ? (
          <Text className="mb-4 text-sm text-red-500">{registerMutation.error.message}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={registerMutation.isPending}
          className="items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
          <Text className="text-base font-bold text-white">
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">Already have an account? </Text>
          <Link href="/login" className="font-semibold text-orange-500">
            Log in
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
