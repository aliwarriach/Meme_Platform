import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESKTOP_FRAME_MIN_WIDTH } from '@/constants/webLayout';
import { useWebThemeMode, type WebThemeMode } from '@/constants/WebThemeMode';

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

// Native's MASTER.md tint, fixed — this component is shared with the native mobile app, which
// stays dark-only exactly as shipped, unaffected by the web light/dark toggle.
const NATIVE_TOKENS = {
  activeTint: '#ff3385',
  inactiveTint: '#e3bdc5',
  barBorder: '#5b3f46',
  barBg: '#2c1b1f',
  createIcon: '#ffffff',
};

// Web-only Neon Plum tokens, mode-aware — this bar only renders on web at narrow (non-desktop)
// viewports, since `DesktopSidebarNav` takes over at >= DESKTOP_FRAME_MIN_WIDTH.
const WEB_TOKENS = {
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
} as const satisfies Record<WebThemeMode, Record<string, string>>;

/**
 * Floating dock on the primary sections, rendered per-screen as an absolute overlay (navigation
 * stays expo-router Stack-based). Intentionally written with plain inline StyleSheet, not
 * NativeWind classNames and not expo-blur's BlurView: prior attempts using either produced a
 * mis-sized/circular bar on Android (BlurView doesn't size to content there; the className path
 * was also unreliable for this overlay). Inline styles render identically on every device with no
 * transform in the path — the reliable choice for this one always-on-top chrome element.
 *
 * Reads `useWebThemeMode()` for its web-rendered tokens only — native always uses `NATIVE_TOKENS`
 * regardless of that value, so the mobile app's own dark-only identity is never affected.
 */
export default function FloatingBottomNav({ active }: FloatingBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mode } = useWebThemeMode();
  const t = Platform.OS === 'web' ? WEB_TOKENS[mode] : NATIVE_TOKENS;
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
  t: typeof NATIVE_TOKENS;
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

const createStyles = (t: typeof NATIVE_TOKENS) =>
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
