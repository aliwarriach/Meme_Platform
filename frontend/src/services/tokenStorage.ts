import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'meme_platform_auth_token';

// expo-secure-store has no web implementation (its web module is an empty object,
// so setItemAsync/getItemAsync/deleteItemAsync all throw there) — fall back to
// localStorage on web, real Keychain/Keystore-backed SecureStore on native.
export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
