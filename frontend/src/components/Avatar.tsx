import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { getAvatarPreset } from '@/constants/avatarPresets';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
  username: string;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  size?: AvatarSize;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 80,
};

const TEXT_SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
};

/** Circular avatar. Precedence: an uploaded photo (`avatarUrl`) always wins; otherwise a chosen
 * built-in avatar (`avatarPreset`, see `constants/avatarPresets.ts`) renders as a gradient +
 * emoji tile; otherwise falls back to the username's initials on a primary-tinted background. */
export default function Avatar({ username, avatarUrl, avatarPreset, size = 'md' }: AvatarProps) {
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

  const preset = getAvatarPreset(avatarPreset);
  if (preset) {
    const px = SIZE_PX[size];
    return (
      <LinearGradient
        colors={preset.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        accessibilityLabel={`${username}'s avatar`}
        style={{
          height: px,
          width: px,
          borderRadius: px / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: px * 0.5 }}>{preset.emoji}</Text>
      </LinearGradient>
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
