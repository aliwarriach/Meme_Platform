import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESKTOP_FRAME_MIN_WIDTH } from '@/constants/webLayout';
import { useThemeMode, type ThemeMode } from '@/constants/ThemeMode';

export type NavDestination = 'feed' | 'communities' | 'compete' | 'profile';

type FloatingBottomNavProps = {
  active: NavDestination;
};

type NavItem = {
  key: NavDestination | 'create';
  href: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  primary?: boolean;
};

const ITEMS: NavItem[] = [
  { key: 'feed', href: '/feed', icon: 'home' },
  { key: 'communities', href: '/communities', icon: 'groups' },
  { key: 'create', href: '/new-post', icon: 'add', primary: true },
  // Segmented [Challenges | Leaderboards] — merged into one slot so challenges gain a
  // top-level entry without growing the nav past 5 items (44pt touch targets on small
  // phones).
  { key: 'compete', href: '/compete', icon: 'emoji-events' },
  { key: 'profile', href: '/profile', icon: 'account-circle' },
];

interface NavTintTokens {
  activeTint: string;
  inactiveTint: string;
  barBorder: string;
  barBg: string;
  createIcon: string;
}

// Neon Plum tokens, mode-aware — same values on both platforms, driven by the one app-wide
// `useThemeMode()`. (This bar only renders on native, and on web at narrow non-desktop
// viewports — `DesktopSidebarNav` takes over web at >= DESKTOP_FRAME_MIN_WIDTH.)
const TOKENS: Record<ThemeMode, NavTintTokens> = {
  dark: {
    activeTint: '#FF5CA0',
    inactiveTint: '#C9A9BA',
    barBorder: 'rgba(255, 255, 255, 0.10)',
    barBg: '#241328',
    createIcon: '#FFFFFF',
  },
  light: {
    activeTint: '#EC4899',
    inactiveTint: '#6B4A5C',
    barBorder: '#F3D9E7',
    barBg: '#FFFFFF',
    createIcon: '#FFFFFF',
  },
};

/**
 * Floating dock on the primary sections, rendered per-screen as an absolute overlay (navigation
 * stays expo-router Stack-based). Intentionally written with plain inline StyleSheet, not
 * NativeWind classNames and not expo-blur's BlurView: prior attempts using either produced a
 * mis-sized/circular bar on Android (BlurView doesn't size to content there; the className path
 * was also unreliable for this overlay). Inline styles render identically on every device with no
 * transform in the path — the reliable choice for this one always-on-top chrome element.
 *
 * Reads the one app-wide `useThemeMode()` — same tokens, same mode, on both platforms.
 */
export default function FloatingBottomNav({ active }: FloatingBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mode } = useThemeMode();
  const t = TOKENS[mode];
  const styles = useMemo(() => createStyles(t), [t]);

  // DesktopShell's DesktopSidebarNav takes over navigation on wide desktop-web viewports —
  // never touched on native, where this condition is always false.
  if (Platform.OS === 'web' && width >= DESKTOP_FRAME_MIN_WIDTH) return null;

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: insets.bottom + 12 }]}>
      <View style={styles.bar}>
        {ITEMS.map((item) => (
          <NavIcon
            key={item.key}
            item={item}
            isActive={active === item.key}
            onPress={() => router.push(item.href as never)}
            t={t}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function NavIcon({
  item,
  isActive,
  onPress,
  t,
  styles,
}: {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  t: NavTintTokens;
  styles: ReturnType<typeof createStyles>;
}) {
  if (item.primary) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a new post"
        onPress={onPress}
        style={styles.createButton}>
        <MaterialIcons name={item.icon} size={28} color={t.createIcon} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.key}
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={styles.iconButton}>
      <MaterialIcons name={item.icon} size={26} color={isActive ? t.activeTint : t.inactiveTint} />
    </Pressable>
  );
}

const createStyles = (t: NavTintTokens) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      left: 24,
      right: 24,
      alignItems: 'center',
    },
    bar: {
      width: '100%',
      maxWidth: 360,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.barBorder,
      backgroundColor: t.barBg,
      paddingHorizontal: 16,
      paddingVertical: 8,
      // Elevation is the Android-reliable shadow; shadow* keys cover iOS.
      elevation: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    iconButton: {
      height: 44,
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    createButton: {
      height: 48,
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: t.activeTint,
    },
  });
