import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';

import { DateField } from '@/components/DateField';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { GoogleSignInFlow } from '@/features/auth/GoogleSignInFlow';
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
    defaultValues: { email: '', username: '', password: '', dateOfBirth: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await registerMutation.mutateAsync({
        email: values.email,
        username: values.username,
        password: values.password,
        date_of_birth: values.dateOfBirth,
      });
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
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled">
        <View className="px-6 py-10">
          {/* Decorative brand mark — same rounded-full + bg-primary-container + text-white token
              combo established on LoginScreen (itself reusing PillButton/Avatar's initials-fallback
              treatment), not a new component or token. Tighter mb-6 (vs. Login's mb-8) since this
              screen carries four fields instead of two and needs the vertical room. Hidden from
              screen readers since the heading below already names the app/purpose. */}
          <View className="mb-6 items-center">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <Text className="font-heading text-2xl text-white">M</Text>
            </View>
            <Text className="mb-1 text-center font-heading text-3xl text-heading">
              Create Your Account
            </Text>
            <Text className="text-center font-body text-base text-ink-muted">
              Join communities and start posting memes.
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
                textContentType="emailAddress"
                accessibilityLabel="Email"
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
                autoComplete="username"
                textContentType="username"
                accessibilityLabel="Username"
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
                autoComplete="new-password"
                textContentType="newPassword"
                accessibilityLabel="Password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />
          {/* Requirement surfaced up front rather than only after a submit-time rejection —
              matches the same rule enforced by registerSchema (min 8 chars). Suppressed once an
              error is showing so the two lines never stack redundantly. */}
          {!errors.password ? (
            <Text className="-mt-3 mb-4 font-body text-xs text-ink-muted">At least 8 characters</Text>
          ) : null}

          {/* Age verification is visually separated from the identity/security fields above —
              addresses the "why are you asking this" hesitation a bare Date of Birth field
              creates when it's the last thing before submit with no context. Reuses the exact
              divider convention LoginScreen established before its Google button, applied here
              to a different kind of separator (field grouping, not "or"). */}
          <View className="mt-2 mb-4 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-outline-variant" />
            <Text className="font-label text-xs uppercase tracking-wide text-ink-muted">
              Age verification
            </Text>
            <View className="h-px flex-1 bg-outline-variant" />
          </View>
          <Text className="mb-3 font-body text-xs text-ink-muted">
            Just confirming you&apos;re 13 or older — this stays private and never shows on your profile.
          </Text>
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <DateField
                label="Date of Birth"
                placeholder="Select your date of birth"
                value={field.value}
                onChange={field.onChange}
                error={errors.dateOfBirth?.message}
              />
            )}
          />

          {registerMutation.isError ? (
            <Text className="mb-4 font-body text-sm text-error">{registerMutation.error.message}</Text>
          ) : null}

          <PillButton
            label={registerMutation.isPending ? 'Creating account…' : 'Create Account'}
            onPress={onSubmit}
            loading={registerMutation.isPending}
          />

          <View className="mt-6 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-outline-variant" />
            <Text className="font-label text-xs uppercase tracking-wide text-ink-muted">or</Text>
            <View className="h-px flex-1 bg-outline-variant" />
          </View>

          <GoogleSignInFlow />

          <View className="mt-6 flex-row justify-center">
            <Text className="font-body text-ink-muted">Already have an account? </Text>
            <Link
              href="/login"
              accessibilityRole="link"
              className="px-1 py-2 font-title text-primary-dim">
              Log in
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
