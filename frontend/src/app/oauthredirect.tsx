import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

/**
 * Landing spot for expo-auth-session's Google OAuth redirect (`<scheme>://oauthredirect`).
 * Normally `expo-web-browser` intercepts this redirect natively and resolves
 * `GoogleSignInFlow`'s pending `promptAsync()` promise before expo-router ever sees a
 * navigation for it. This route only renders when that interception didn't happen — e.g. Android
 * relaunched the app cold partway through the Google consent flow, so the pending promise/JS
 * context is already gone — which used to surface expo-router's raw "Unmatched Route" screen with
 * the redirect URL dumped as text. `maybeCompleteAuthSession()` is a harmless no-op if there's no
 * pending session, and a real recovery if one is still alive; either way we land somewhere real
 * instead of a dead end. A relaunched sign-in still requires the user to tap "Continue with
 * Google" again from /login — this route cannot resume an already-gone request.
 */
export default function OAuthRedirect() {
  const token = useSelector((state: RootState) => state.auth.token);
  WebBrowser.maybeCompleteAuthSession();
  return <Redirect href={token ? '/' : '/login'} />;
}
