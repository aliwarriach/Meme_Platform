import Constants from 'expo-constants';

const BACKEND_PORT = 6001;

/**
 * Resolves the backend base URL. Priority:
 *  1. An explicit `EXPO_PUBLIC_API_URL` (a fixed/remote backend — staging, prod, or a tunnel
 *     URL) always wins.
 *  2. Otherwise, in a dev build, derive the host from the address the app loaded its JS bundle
 *     from (the Expo dev-server host) and reuse it with the backend port. This makes the API
 *     automatically follow the dev machine's current LAN IP — switching WiFi no longer requires
 *     editing anything, as long as the phone and laptop are on the same network.
 *  3. Localhost fallback (simulator / web).
 */
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  // `hostUri` looks like "10.250.47.218:8081"; `debuggerHost` is the older field name.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    null;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${BACKEND_PORT}`;

  return `http://127.0.0.1:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
