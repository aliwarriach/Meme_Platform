import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { signOut } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

export default function SessionScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  const onLogout = async () => {
    await dispatch(signOut());
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-orange-500">
            <Text className="text-2xl font-extrabold text-white">
              {user.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            className="text-2xl font-extrabold text-neutral-900 dark:text-white">
            {user.username}
          </Text>
          <Text className="text-base text-neutral-500 dark:text-neutral-400">{user.email}</Text>
        </View>

        <Pressable
          onPress={() => router.push('/feed')}
          accessibilityRole="button"
          accessibilityLabel="Feed"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Feed</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/friends')}
          accessibilityRole="button"
          accessibilityLabel="Friends"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Friends</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/communities')}
          accessibilityRole="button"
          accessibilityLabel="Communities"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Communities</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/leaderboards')}
          accessibilityRole="button"
          accessibilityLabel="Leaderboards"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Leaderboards</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/voting')}
          accessibilityRole="button"
          accessibilityLabel="Meme of the Day, Week, or Month voting"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Meme of the Day/Week/Month</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/inbox')}
          accessibilityRole="button"
          accessibilityLabel="Inbox"
          className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
          <Text className="text-base font-bold text-white">Inbox</Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          className="items-center rounded-xl border border-neutral-300 py-3.5 dark:border-neutral-700">
          <Text className="text-base font-bold text-neutral-900 dark:text-white">Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
