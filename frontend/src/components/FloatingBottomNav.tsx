import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NavDestination = 'feed' | 'communities' | 'leaderboards' | 'profile';

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
  { key: 'leaderboards', href: '/leaderboards', icon: 'emoji-events' },
  { key: 'profile', href: '/profile', icon: 'account-circle' },
];

const ACTIVE_TINT = '#ff3385';
const INACTIVE_TINT = '#e3bdc5';

/**
 * Floating dock on the primary sections, rendered per-screen as an absolute overlay (navigation
 * stays expo-router Stack-based). Intentionally written with plain inline StyleSheet, not
 * NativeWind classNames and not expo-blur's BlurView: prior attempts using either produced a
 * mis-sized/circular bar on Android (BlurView doesn't size to content there; the className path
 * was also unreliable for this overlay). Inline styles render identically on every device with no
 * transform in the path — the reliable choice for this one always-on-top chrome element.
 */
export default function FloatingBottomNav({ active }: FloatingBottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: insets.bottom + 12 }]}>
      <View style={styles.bar}>
        {ITEMS.map((item) => (
          <NavIcon
            key={item.key}
            item={item}
            isActive={active === item.key}
            onPress={() => router.push(item.href as never)}
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
}: {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}) {
  if (item.primary) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a new post"
        onPress={onPress}
        style={styles.createButton}>
        <MaterialIcons name={item.icon} size={28} color="#ffffff" />
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
      <MaterialIcons name={item.icon} size={26} color={isActive ? ACTIVE_TINT : INACTIVE_TINT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#5b3f46',
    backgroundColor: '#2c1b1f',
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
    backgroundColor: ACTIVE_TINT,
  },
});
