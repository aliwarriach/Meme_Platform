import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_HEADING_FONT_STACK } from '@/constants/webCommunityTheme';

interface WebCommunityAvatarProps {
  label: string;
  imageUrl?: string | null;
  size?: number;
  square?: boolean;
}

/** Circular (or rounded-square, for community icons) avatar for the "Vibrant & Block-based"
 * community web pages — primary-tinted initials fallback, theme-aware. Not a reskin of the
 * shared native `components/Avatar.tsx`; standalone equivalent scoped to this web tree. */
export default function WebCommunityAvatar({ label, imageUrl, size = 40, square = false }: WebCommunityAvatarProps) {
  const { colors } = useCommunityWebTheme();
  const dimension = { height: size, width: size, borderRadius: square ? size * 0.3 : size / 2 };

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.image, dimension, { borderColor: colors.border }]} />;
  }

  return (
    <View style={[styles.fallback, dimension, { backgroundColor: colors.primary }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4, color: colors.onPrimary }]}>
        {label.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: COMMUNITY_WEB_HEADING_FONT_STACK,
    fontWeight: '600',
  },
});
