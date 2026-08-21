import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { Pressable, Text, View } from 'react-native';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useUnreadNotificationCount } from '@/services/useNotifications';

/** Bell icon + unread badge, dropped into `TopBar`'s `rightActions` slot. */
export default function NotificationBell() {
  const router = useRouter();
  const unreadQuery = useUnreadNotificationCount();
  const count = unreadQuery.data?.count ?? 0;
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      onPress={() => router.push('/notifications')}
      className="h-11 w-11 items-center justify-center">
      <View>
        <MaterialIcons name="notifications-none" size={22} color={c.heading} />
        {count > 0 ? (
          <View className="absolute -right-1 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-container px-1">
            <Text className="font-label text-[10px] leading-none text-white">
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
