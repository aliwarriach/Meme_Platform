import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';

interface WebAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
}

/** Circular avatar for the web feed — indigo-ring initials fallback, matching this page's own
 * token set (light/dark aware). Not a reskin of the shared `components/Avatar.tsx` (that file
 * is native-resolved); this is a standalone equivalent scoped to the web feed tree. */
export default function WebAvatar({ username, avatarUrl, size = 36 }: WebAvatarProps) {
  const { colors: FEED_WEB_COLORS, fontStack } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(FEED_WEB_COLORS, fontStack), [FEED_WEB_COLORS, fontStack]);
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

const createStyles = (FEED_WEB_COLORS: VaporwaveTheme['colors'], fontStack: string) => StyleSheet.create({
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
    fontFamily: fontStack,
    fontWeight: '600',
    color: FEED_WEB_COLORS.onAccent,
  },
});
