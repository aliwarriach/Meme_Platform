import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useProfileWebTheme } from '@/constants/ProfileWebTheme';
import { PROFILE_WEB_HEADING_FONT_STACK } from '@/constants/webProfileTheme';

interface WebProfileAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
}

/** Circular avatar for the profile web screen — primary-ring initials fallback, matching this
 * page's own token set. Standalone equivalent of the native `components/Avatar.tsx` (that file
 * is native-resolved and aliases the old NativeWind token set) — same precedent `WebAvatar`
 * (feed) and `WebCommunityAvatar` used for their own trees. Not Skia-backed: this is a plain
 * `expo-image`/initials fallback, so the react-native-skia web readiness-gate pattern used
 * elsewhere in this app's web routes does not apply here. */
export default function WebProfileAvatar({ username, avatarUrl, size = 88 }: WebProfileAvatarProps) {
  const { colors } = useProfileWebTheme();
  const dimension = { height: size, width: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[dimension, { borderWidth: 2, borderColor: colors.primary }]} />;
  }

  return (
    <View style={[styles.fallback, dimension, { backgroundColor: colors.elevated, borderColor: colors.primary }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36, color: colors.primaryText }]}>
        {username.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  initials: {
    fontFamily: PROFILE_WEB_HEADING_FONT_STACK,
  },
});
