import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';

import { bootstrapAuth } from '@/store/authSlice';
import { store, type AppDispatch, type RootState } from '@/store/store';
import { connectMemeSendingSocket, disconnectMemeSendingSocket } from '@/services/memeSendingSocket';
import { useMemeSendingSocketSync } from '@/services/useMemeSending';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthBoundary() {
  const dispatch = useDispatch<AppDispatch>();
  const isBootstrapped = useSelector((state: RootState) => state.auth.isBootstrapped);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isBootstrapped) SplashScreen.hideAsync();
  }, [isBootstrapped]);

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

  if (!isBootstrapped) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
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
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthBoundary />
          </ThemeProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
