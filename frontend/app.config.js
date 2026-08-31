// Dynamic config (instead of static app.json) so the Android cleartext-HTTP allowance can be
// scoped to dev/local builds only — see SecurityIssues.md H-2. `EAS_BUILD_PROFILE` is set by
// `eas build` to the profile name being built (undefined for local `expo start`/`expo run`).
// Cleartext stays enabled for anything that isn't an explicit `production` build: local LAN dev
// needs it (the phone talks to the dev machine's `http://<lan-ip>:6001>` — see
// src/constants/config.ts), and `preview` builds always point at an `https://` ngrok tunnel
// (frontend/eas.json) so the permission is unused there, not exploited.
const IS_PRODUCTION_BUILD = process.env.EAS_BUILD_PROFILE === 'production';

module.exports = {
  expo: {
    name: 'mosh',
    slug: 'mosh',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    // 'com.memeversestudio.app' is registered alongside the app's own 'frontend' deep-link
    // scheme specifically so Android has an intent filter for expo-auth-session's Google
    // OAuth redirect, which is built from the package name (Application.applicationId +
    // ':/oauthredirect'), not from this scheme field — without it, Android has no handler
    // for that URI at all, so the post-consent redirect silently strands in the browser.
    // Requires a native rebuild (AndroidManifest.xml intent filters are build-time only,
    // not something a JS/Metro reload can pick up).
    scheme: ['frontend', 'com.memeversestudio.app'],
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
    },
    android: {
      package: 'com.memeversestudio.app',
      adaptiveIcon: {
        backgroundColor: '#DB2777',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // Explicit rather than relying on Expo's default — the window resizes when the keyboard
      // opens, so `KeyboardAvoidingView`'s `'height'` behavior (message composer, comment boxes)
      // has an actually-shrunk window to work with instead of the keyboard just overlaying it.
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#120A10',
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      ],
      'expo-sharing',
      '@react-native-community/datetimepicker',
      ...(IS_PRODUCTION_BUILD
        ? []
        : [
            [
              'expo-build-properties',
              {
                android: {
                  usesCleartextTraffic: true,
                },
              },
            ],
          ]),
      [
        'expo-notifications',
        {
          // Android renders this as a flat single-color silhouette (alpha channel only,
          // color info discarded) — must be a plain white shape on transparency, never the
          // full-color app icon. See `notification-icon.png` (frontend/assets/images).
          icon: './assets/images/notification-icon.png',
          color: '#FF5CA0',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '926db066-d8cc-43c4-9809-d093be890bc4',
      },
    },
  },
};
