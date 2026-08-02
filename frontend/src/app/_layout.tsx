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
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';

import DesktopShell from '@/components/web/DesktopShell';
import { bootstrapAuth } from '@/store/authSlice';
import { store, type AppDispatch, type RootState } from '@/store/store';
import { connectMemeSendingSocket, disconnectMemeSendingSocket } from '@/services/memeSendingSocket';
import { useMemeSendingSocketSync } from '@/services/useMemeSending';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthBoundary({ fontsLoaded }: { fontsLoaded: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const isBootstrapped = useSelector((state: RootState) => state.auth.isBootstrapped);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isBootstrapped && fontsLoaded) SplashScreen.hideAsync();
  }, [isBootstrapped, fontsLoaded]);

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

  useMemeSendingSocketSync();

  if (!isBootstrapped || !fontsLoaded) return null;

  return (
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
      </Stack>
    </DesktopShell>
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
          {/* MemeVerse Studio design system is dark-mode-only ("Vivid Meme Culture") — never follow system light mode */}
          <ThemeProvider value={DarkTheme}>
            <AuthBoundary fontsLoaded={fontsLoaded} />
          </ThemeProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
