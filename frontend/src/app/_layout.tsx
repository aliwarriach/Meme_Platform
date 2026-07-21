import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';

import { bootstrapAuth } from '@/store/authSlice';
import { store, type AppDispatch, type RootState } from '@/store/store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthBoundary() {
  const dispatch = useDispatch<AppDispatch>();
  const isBootstrapped = useSelector((state: RootState) => state.auth.isBootstrapped);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isBootstrapped) SplashScreen.hideAsync();
  }, [isBootstrapped]);

  if (!isBootstrapped) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthBoundary />
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
