import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { DESKTOP_SIDEBAR_WIDTH } from '@/constants/webLayout';
import { useThemeMode, type ThemeMode } from '@/constants/ThemeMode';
import type { RootState } from '@/store/store';

type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Feed', href: '/feed', icon: 'home' },
  { label: 'Search', href: '/search', icon: 'search' },
  { label: 'Communities', href: '/communities', icon: 'groups' },
  { label: 'Inbox', href: '/inbox', icon: 'mail' },
  { label: 'Friends', href: '/friends', icon: 'people' },
  { label: 'Voting', href: '/voting', icon: 'how-to-vote' },
  { label: 'Compete', href: '/compete', icon: 'emoji-events' },
  { label: 'Profile', href: '/profile', icon: 'account-circle' },
];

// Neon Plum shell tokens (Group A in the palette spec) — mode-aware pairs, web-only component
// (never rendered on native), so free to diverge from MASTER.md's native `#ff3385`/`#e3bdc5`
// shell without touching the mobile app (unlike `FloatingBottomNav`, which native shares).
const SHELL_TOKENS = {
  dark: {
    activeTint: '#FF5CA0',
    inactiveTint: '#C9A9BA',
    divider: 'rgba(255, 255, 255, 0.09)',
    brand: '#FFFFFF',
    itemHovered: 'rgba(255, 214, 236, 0.07)',
    itemActive: 'rgba(255, 61, 138, 0.14)',
    itemLabelActive: '#FFFFFF',
    ctaFill: '#DB2777',
    ctaLabel: '#FFFFFF',
  },
  light: {
    activeTint: '#EC4899',
    inactiveTint: '#6B4A5C',
    divider: '#F3D9E7',
    brand: '#2A1220',
    itemHovered: 'rgba(219, 39, 119, 0.07)',
    itemActive: 'rgba(219, 39, 119, 0.10)',
    itemLabelActive: '#2A1220',
    ctaFill: '#BE185D',
    ctaLabel: '#FFFFFF',
  },
} as const satisfies Record<ThemeMode, Record<string, string>>;

/**
 * Persistent left-hand nav for desktop web — the Instagram/Twitter-desktop pattern. Mounted
 * once by `DesktopShell` (not per-screen like `FloatingBottomNav`), so it never duplicates
 * across route changes. Hidden while logged out, mirroring the mobile bottom nav which is
 * likewise never rendered on the login/register screens.
 *
 * Reads the same app-wide `useThemeMode()` every screen does — this is the fix for "the
 * sidebar never changed with light/dark mode": it used to be permanently dark-only, completely
 * unaware of whatever mode the current screen had picked.
 */
export default function DesktopSidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSelector((state: RootState) => state.auth.token);
  const { mode } = useThemeMode();
  const t = SHELL_TOKENS[mode];
  const styles = useMemo(() => createStyles(t), [t]);

  if (!token) return null;

  return (
    <View style={[styles.root, { width: DESKTOP_SIDEBAR_WIDTH }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="MemeVerse, go to feed"
        onPress={() => router.push('/feed' as never)}
        style={styles.brandButton}>
        <Text style={styles.brand}>MemeVerse</Text>
      </Pressable>

      <View style={styles.items}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Pressable
              key={item.href}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => router.push(item.href as never)}
              style={({ hovered }) => [
                styles.item,
                isActive && styles.itemActive,
                hovered && !isActive && styles.itemHovered,
              ]}>
              <MaterialIcons name={item.icon} size={24} color={isActive ? t.activeTint : t.inactiveTint} />
              <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a new post"
        onPress={() => router.push('/new-post' as never)}
        style={({ hovered }) => [styles.createButton, hovered && styles.createButtonHovered]}>
        <MaterialIcons name="add" size={22} color={t.ctaLabel} />
        <Text style={styles.createLabel}>Create</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (t: (typeof SHELL_TOKENS)[ThemeMode]) =>
  StyleSheet.create({
    root: {
      height: '100%',
      borderRightWidth: 1,
      borderRightColor: t.divider,
      paddingVertical: 32,
      paddingHorizontal: 20,
    },
    brandButton: {
      marginBottom: 36,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
    },
    brand: {
      fontFamily: 'BeVietnamPro_700Bold',
      fontSize: 22,
      color: t.brand,
    },
    items: {
      flex: 1,
      gap: 4,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    itemHovered: {
      backgroundColor: t.itemHovered,
    },
    itemActive: {
      backgroundColor: t.itemActive,
    },
    itemLabel: {
      fontFamily: 'BeVietnamPro_500Medium',
      fontSize: 15,
      color: t.inactiveTint,
    },
    itemLabelActive: {
      color: t.itemLabelActive,
      fontFamily: 'BeVietnamPro_600SemiBold',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: t.ctaFill,
    },
    createButtonHovered: {
      opacity: 0.9,
    },
    createLabel: {
      fontFamily: 'BeVietnamPro_600SemiBold',
      fontSize: 15,
      color: t.ctaLabel,
    },
  });
