import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground handler: without this, a push that arrives while the app is open is silently
// swallowed on some platforms instead of showing a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permission and resolves an Expo push token for this device, or
 * `null` if push isn't available (web, simulator/emulator, or permission denied) — callers
 * must treat `null` as "skip registration," not an error.
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  // expo-notifications' push token API isn't meaningful on web (this app also runs as a
  // desktop-web shell, see DesktopShell) and physical-device push tokens don't exist on
  // simulators/emulators.
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export function currentPushPlatform(): string {
  return Platform.OS;
}
