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

/** Deterministic hash of a username into an index — same input always picks the same avatar
 * color, so a given user's fallback tile doesn't change color on re-render/re-fetch. */
function hashUsername(username: string, paletteSize: number): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % paletteSize;
}

/** Circular avatar for the web feed — initials fallback picks from a 5-color palette keyed by a
 * hash of the username (one flat brand-pink fill previously), light/dark aware. Not a reskin of
 * the shared `components/Avatar.tsx` (that file is native-resolved); this is a standalone
 * equivalent scoped to the web feed tree. */
export default function WebAvatar({ username, avatarUrl, size = 36 }: WebAvatarProps) {
  const { colors: FEED_WEB_COLORS, fontStack } = useVaporwaveTheme();
  const fallbackColor = FEED_WEB_COLORS.avatarPalette[hashUsername(username, FEED_WEB_COLORS.avatarPalette.length)];
  const styles = useMemo(
    () => createStyles(FEED_WEB_COLORS, fontStack, fallbackColor),
    [FEED_WEB_COLORS, fontStack, fallbackColor],
  );
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

const createStyles = (FEED_WEB_COLORS: VaporwaveTheme['colors'], fontStack: string, fallbackColor: string) => StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.borderHighlight,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fallbackColor,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.borderHighlight,
  },
  initials: {
    fontFamily: fontStack,
    fontWeight: '600',
    color: FEED_WEB_COLORS.onAccent,
  },
});
