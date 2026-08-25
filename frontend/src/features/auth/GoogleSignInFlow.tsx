import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { DateField } from '@/components/DateField';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { isPendingRegistration } from '@/services/googleAuth';
import {
  useCompleteGoogleRegistrationMutation,
  useGoogleAuthMutation,
} from '@/services/useGoogleAuth';
import { persistCredentials } from '@/store/authSlice';
import type { AppDispatch } from '@/store/store';

// Required once per app for the OAuth browser popup/redirect to close itself correctly
// (matters most on web) — see expo-auth-session's docs.
WebBrowser.maybeCompleteAuthSession();

/**
 * "Sign in with Google" (SecurityFeatures.md F-7) — one component covering both cases
 * the backend can return: an existing/linked account logs straight in, a brand-new
 * Google identity gets a short inline "pick a username + date of birth" step before the
 * account is actually created (`POST /auth/google/complete`). Dropped into both
 * LoginScreen and RegisterScreen.
 *
 * NEEDS REAL GOOGLE OAUTH CLIENT IDS TO FUNCTION — see .claude/memory/hardening.md for
 * the Google Cloud Console setup steps. Not yet exercised end-to-end (no credentials to
 * test against in this session) — verify the whole flow on a real device once configured.
 */
export function GoogleSignInFlow() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const googleAuth = useGoogleAuthMutation();
  const completeRegistration = useCompleteGoogleRegistrationMutation();

  const [pending, setPending] = useState<{ pendingToken: string; email: string } | null>(null);
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) return;

    googleAuth.mutate(idToken, {
      onSuccess: async (result) => {
        if (isPendingRegistration(result)) {
          setPending({ pendingToken: result.pending_token, email: result.email });
          return;
        }
        await dispatch(
          persistCredentials({ token: result.access_token, user: result.user })
        ).unwrap();
        router.replace('/');
      },
    });
    // Only the OAuth response should re-trigger this — googleAuth/dispatch/router are
    // stable across renders and re-running on their identity would refire the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const onCompleteRegistration = () => {
    if (!pending) return;
    completeRegistration.mutate(
      { pending_token: pending.pendingToken, username, date_of_birth: dateOfBirth },
      {
        onSuccess: async (result) => {
          await dispatch(
            persistCredentials({ token: result.access_token, user: result.user })
          ).unwrap();
          router.replace('/');
        },
      }
    );
  };

  if (pending) {
    return (
      <View className="mt-4 border-t border-outline-variant/30 pt-4">
        <Text className="mb-3 font-title text-sm text-heading">
          One more step for {pending.email}
        </Text>
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <DateField
          label="Date of Birth"
          placeholder="Select your date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
        />
        {completeRegistration.isError ? (
          <Text className="mb-2 font-body text-xs text-error">
            {completeRegistration.error.message}
          </Text>
        ) : null}
        <PillButton
          label="Finish creating account"
          onPress={onCompleteRegistration}
          loading={completeRegistration.isPending}
          disabled={!username || !dateOfBirth}
        />
      </View>
    );
  }

  return (
    <View className="mt-4">
      {googleAuth.isError ? (
        <Text className="mb-2 font-body text-xs text-error">{googleAuth.error.message}</Text>
      ) : null}
      <PillButton
        label="Continue with Google"
        variant="outline"
        onPress={() => promptAsync()}
        disabled={!request}
        loading={googleAuth.isPending}
      />
    </View>
  );
}
