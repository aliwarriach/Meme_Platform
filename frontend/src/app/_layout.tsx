import '@/global.css';

import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import { MaterialIcons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';

import DesktopShell from '@/components/web/DesktopShell';
import { ThemeModeProvider, useThemeMode } from '@/constants/ThemeMode';
import { bootstrapAuth } from '@/store/authSlice';
import { store, type AppDispatch, type RootState } from '@/store/store';
import { connectMemeSendingSocket, disconnectMemeSendingSocket } from '@/services/memeSendingSocket';
import { useMessagingSocketSync } from '@/services/useMessaging';
import { useNotificationsSocketSync, useRegisterPushTokenMutation, useUnregisterPushTokenMutation } from '@/services/useNotifications';
import { currentPushPlatform, getExpoPushTokenAsync } from '@/services/pushNotifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Neon Plum navigation chrome (header/back-gesture tint, on the rare screen that shows a native
// header) — same token values as `src/global.css`'s `.dark`/`:root`, kept as a small hand-synced
// mirror since `@react-navigation`'s Theme type wants literal colors, not CSS vars.
const NEON_PLUM_NAV_DARK: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: '#FF5CA0', background: '#1A0E1B', card: '#241328', text: '#FDF2F8', border: '#4A2C42', notification: '#FF9B9B' },
};
const NEON_PLUM_NAV_LIGHT: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: '#EC4899', background: '#FFF7FB', card: '#FFFFFF', text: '#2A1220', border: '#C98FB0', notification: '#BA1A1A' },
};

function AuthBoundary({ fontsLoaded }: { fontsLoaded: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const isBootstrapped = useSelector((state: RootState) => state.auth.isBootstrapped);
  const token = useSelector((state: RootState) => state.auth.token);
  const { mode, isHydrated: isThemeHydrated } = useThemeMode();
  const registerPushToken = useRegisterPushTokenMutation();
  const unregisterPushToken = useUnregisterPushTokenMutation();
  const expoPushTokenRef = useRef<string | null>(null);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isBootstrapped && isThemeHydrated && fontsLoaded) SplashScreen.hideAsync();
  }, [isBootstrapped, isThemeHydrated, fontsLoaded]);

  // The socket connection tracks the auth token directly — connect once logged in,
  // disconnect on logout, so an unauthenticated client never opens the WS. No cleanup
  // function here: bootstrapAuth() flips token from null -> <jwt> on every fresh load,
  // which would otherwise run this effect twice in a row (once with token=null, then
  // again once bootstrapped) — the first run's cleanup would tear down the socket the
  // second run just opened, since connectMemeSendingSocket is a module-level singleton
  // React doesn't track per-effect-instance. Only an explicit token->null transition
  // (logout) should disconnect.
  useEffect(() => {
    if (token) {
      connectMemeSendingSocket(token, dispatch);
    } else {
      disconnectMemeSendingSocket();
    }
  }, [token, dispatch]);

  useMessagingSocketSync();
  useNotificationsSocketSync();

  // Mirrors the socket effect above: register a device push token once logged in, drop it
  // on logout so a signed-out device stops receiving pushes for that account. `getExpoPushTokenAsync`
  // resolves `null` on web/simulator/permission-denied — registration is skipped, not retried.
  useEffect(() => {
    if (!token) {
      if (expoPushTokenRef.current) {
        unregisterPushToken.mutate(expoPushTokenRef.current);
        expoPushTokenRef.current = null;
      }
      return;
    }

    let cancelled = false;
    getExpoPushTokenAsync()
      .then((expoToken) => {
        if (cancelled || !expoToken) return;
        expoPushTokenRef.current = expoToken;
        registerPushToken.mutate({ token: expoToken, platform: currentPushPlatform() });
      })
      .catch(() => {
        // Permission denied or push unavailable on this device — the app works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [token, registerPushToken, unregisterPushToken]);

  if (!isBootstrapped || !isThemeHydrated || !fontsLoaded) return null;

  return (
    <ThemeProvider value={mode === 'dark' ? NEON_PLUM_NAV_DARK : NEON_PLUM_NAV_LIGHT}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <DesktopShell>
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="feed" />
        <Stack.Screen name="new-post" />
        <Stack.Screen name="communities" />
        <Stack.Screen name="communities/new" />
        <Stack.Screen name="communities/[id]" />
        <Stack.Screen name="communities/[id]/challenges/new" />
        <Stack.Screen name="communities/[id]/challenges/vs" />
        <Stack.Screen name="communities/[id]/challenges/[challengeId]" />
        <Stack.Screen name="leaderboards" />
        <Stack.Screen name="voting" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="inbox/[conversationId]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="challenges/[challengeId]" />
        <Stack.Screen name="compete" />
        <Stack.Screen name="compete/open/new" />
        <Stack.Screen name="tag/[slug]" />
        </Stack>
      </DesktopShell>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    ...MaterialIcons.font,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeModeProvider>
            <AuthBoundary fontsLoaded={fontsLoaded} />
          </ThemeModeProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
