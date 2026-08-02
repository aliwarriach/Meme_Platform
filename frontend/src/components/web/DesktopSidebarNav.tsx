import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { DESKTOP_SIDEBAR_WIDTH } from '@/constants/webLayout';
import type { RootState } from '@/store/store';

type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Feed', href: '/feed', icon: 'home' },
  { label: 'Communities', href: '/communities', icon: 'groups' },
  { label: 'Inbox', href: '/inbox', icon: 'mail' },
  { label: 'Friends', href: '/friends', icon: 'people' },
  { label: 'Voting', href: '/voting', icon: 'how-to-vote' },
  { label: 'Leaderboards', href: '/leaderboards', icon: 'emoji-events' },
  { label: 'Profile', href: '/profile', icon: 'account-circle' },
];

const ACTIVE_TINT = '#ff3385';
const INACTIVE_TINT = '#e3bdc5';

/**
 * Persistent left-hand nav for desktop web — the Instagram/Twitter-desktop pattern. Mounted
 * once by `DesktopShell` (not per-screen like `FloatingBottomNav`), so it never duplicates
 * across route changes. Hidden while logged out, mirroring the mobile bottom nav which is
 * likewise never rendered on the login/register screens.
 */
export default function DesktopSidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSelector((state: RootState) => state.auth.token);

  if (!token) return null;

  return (
    <View style={[styles.root, { width: DESKTOP_SIDEBAR_WIDTH }]}>
      <Text style={styles.brand}>MemeVerse</Text>

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
              <MaterialIcons name={item.icon} size={24} color={isActive ? ACTIVE_TINT : INACTIVE_TINT} />
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
        <MaterialIcons name="add" size={22} color="#ffffff" />
        <Text style={styles.createLabel}>Create</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#372529',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  brand: {
    fontFamily: 'BeVietnamPro_700Bold',
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 36,
    paddingHorizontal: 12,
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
    backgroundColor: '#27171b',
  },
  itemActive: {
    backgroundColor: '#372529',
  },
  itemLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 15,
    color: '#e3bdc5',
  },
  itemLabelActive: {
    color: '#ffffff',
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: ACTIVE_TINT,
  },
  createButtonHovered: {
    backgroundColor: '#ff4a8c',
  },
  createLabel: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
});
