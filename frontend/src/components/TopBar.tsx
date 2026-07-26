import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TopBarProps = {
  title: string;
  showBack?: boolean;
  rightActions?: ReactNode;
};

/** Shared top app bar: back arrow (optional) + pure-white title + right-aligned action icons. */
export default function TopBar({ title, showBack = false, rightActions }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="flex-row items-center justify-between border-b border-outline-variant/30 bg-bg px-4 pb-3">
      <View className="min-w-[44px] flex-row items-center">
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
        ) : null}
      </View>
      <Text className="font-heading text-lg text-heading" numberOfLines={1}>
        {title}
      </Text>
      <View className="min-w-[44px] flex-row items-center justify-end gap-1">{rightActions}</View>
    </View>
  );
}
