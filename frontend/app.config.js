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
    name: 'frontend',
    slug: 'frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'frontend',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
    },
    android: {
      package: 'com.memeversestudio.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
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
          backgroundColor: '#208AEF',
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
          icon: './assets/images/icon.png',
          color: '#ff3385',
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
