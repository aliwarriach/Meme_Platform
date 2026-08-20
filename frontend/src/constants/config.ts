import Constants from 'expo-constants';

const BACKEND_PORT = 6001;

/**
 * Resolves the backend base URL. Priority:
 *  1. An explicit `EXPO_PUBLIC_API_URL` (a fixed/remote backend — staging, prod, or a tunnel
 *     URL) always wins.
 *  2. Otherwise, in a dev build (`__DEV__`), derive the host from the address the app loaded
 *     its JS bundle from (the Expo dev-server host) and reuse it with the backend port. This
 *     makes the API automatically follow the dev machine's current LAN IP — switching WiFi no
 *     longer requires editing anything, as long as the phone and laptop are on the same network.
 *  3. Dev-only localhost fallback (simulator / web).
 *
 * A non-dev build (a release/production JS bundle) that reaches here has no
 * `EXPO_PUBLIC_API_URL` configured — refuse to start rather than silently falling back to a
 * plaintext `http://` LAN/localhost URL that would carry bearer JWTs unencrypted
 * (SecurityIssues.md H-2). Set `EXPO_PUBLIC_API_URL` to an `https://` origin in the relevant
 * `eas.json` build profile before shipping.
 */
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  if (!__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Refusing to fall back to a plaintext local backend in a ' +
        'non-dev build — set EXPO_PUBLIC_API_URL to an https:// origin in eas.json for this build profile.'
    );
  }

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
