import { Image } from 'expo-image';
import { Text, View } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
  username: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

const TEXT_SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
};

/** Circular avatar; falls back to the username's initials on a primary-tinted background when no image exists yet. */
export default function Avatar({ username, avatarUrl, size = 'md' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        accessibilityIgnoresInvertColors
        className={`${sizeClass} rounded-full`}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`${sizeClass} items-center justify-center rounded-full bg-primary-container`}>
      <Text className={`font-title text-white ${TEXT_SIZE_CLASSES[size]}`}>
        {username.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
