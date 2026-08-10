import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FEED_WEB_COLORS, FEED_WEB_FONT_STACK } from '@/constants/webFeedTheme';

interface WebAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
}

/** Circular avatar for the "Dark Cinema" web feed — indigo-ring initials fallback, matching
 * this page's own token set. Not a reskin of the shared `components/Avatar.tsx` (that file
 * is native-resolved); this is a standalone equivalent scoped to the web feed tree. */
export default function WebAvatar({ username, avatarUrl, size = 36 }: WebAvatarProps) {
  const dimension = { height: size, width: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, dimension]} />;
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{username.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.borderHighlight,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FEED_WEB_COLORS.indigoSecondary,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.borderHighlight,
  },
  initials: {
    fontFamily: FEED_WEB_FONT_STACK,
    fontWeight: '600',
    color: FEED_WEB_COLORS.onAccent,
  },
});
