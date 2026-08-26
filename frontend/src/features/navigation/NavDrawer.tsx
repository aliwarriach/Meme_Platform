import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useThemeMode, type ThemePreference } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { signOut } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

interface NavDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// Friends/Communities/Competitions only — Inbox already has its own icon in the feed header,
// Compete already lives on the bottom nav (and is visible from the feed itself), so both are
// deliberately left out of this list rather than duplicated.
const LINKS: { label: string; href: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Friends', href: '/friends', icon: 'people-outline' },
  { label: 'Communities', href: '/communities', icon: 'groups' },
  { label: 'Competitions', href: '/voting', icon: 'military-tech' },
];

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
  { value: 'system', label: 'System', icon: 'brightness-auto' },
];

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);
const DIVIDER_WIDTH = (DRAWER_WIDTH * 2) / 3;

function Divider() {
  return (
    <View className="items-center py-2">
      <View className="h-[1px] bg-outline-variant/30" style={{ width: DIVIDER_WIDTH }} />
    </View>
  );
}

/** Left-side slide-in drawer, opened from the hamburger icon in the main feed's top-left. Layout
 * top to bottom: own avatar+name (taps through to the profile), a divider, the theme toggle, then
 * Friends/Communities/Competitions — the sections not already reachable from the feed header
 * (Inbox) or bottom nav (Compete) — then a second divider and Log Out pinned to the bottom. Plain
 * `Animated` translateX (not Reanimated) — a one-shot open/close slide doesn't need a
 * gesture-driven worklet. */
export function NavDrawer({ visible, onClose }: NavDrawerProps) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { mode, preference, setPreference } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const user = useSelector((state: RootState) => state.auth.user);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const navigate = (href: string) => {
    onClose();
    router.push(href as never);
  };

  const onLogout = async () => {
    onClose();
    await dispatch(signOut());
    router.replace('/login');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 flex-row">
        <Animated.View
          style={{
            width: DRAWER_WIDTH,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateX }],
          }}
          className="border-r border-outline-variant/30 bg-bg">
          <View className="flex-1">
            {user ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open your profile"
                onPress={() => navigate('/profile')}
                className="flex-row items-center gap-3 px-4 py-4">
                <Avatar username={user.username} avatarUrl={user.avatarUrl} avatarPreset={user.avatarPreset} size="md" />
                <Text className="flex-1 font-title text-heading" numberOfLines={1}>
                  {user.username}
                </Text>
              </Pressable>
            ) : null}

            <Divider />

            <View className="gap-1 px-2">
              <Text className="px-2 pb-1 pt-1 font-label text-xs uppercase tracking-wide text-ink-muted">
                Appearance
              </Text>
              <View className="mb-1 flex-row items-center gap-1 rounded-full border border-outline-variant bg-surface-high/60 p-1">
                {APPEARANCE_OPTIONS.map((option) => {
                  const selected = preference === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} mode`}
                      accessibilityState={{ selected }}
                      onPress={() => setPreference(option.value)}
                      className={`min-h-[40px] flex-1 flex-row items-center justify-center gap-1 rounded-full ${
                        selected ? 'bg-primary-container' : ''
                      }`}>
                      <MaterialIcons name={option.icon} size={16} color={selected ? c.white : c.inkMuted} />
                      <Text className={`font-title text-xs ${selected ? 'text-white' : 'text-ink-muted'}`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {LINKS.map((link) => (
                <Pressable
                  key={link.href}
                  accessibilityRole="button"
                  accessibilityLabel={link.label}
                  onPress={() => navigate(link.href)}
                  className="min-h-[48px] flex-row items-center gap-3 rounded-card px-3">
                  <MaterialIcons name={link.icon} size={22} color={c.inkMuted} />
                  <Text className="font-title text-heading">{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Divider />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={onLogout}
              className="mx-2 min-h-[48px] flex-row items-center gap-3 rounded-card px-3">
              <MaterialIcons name="logout" size={22} color={c.error} />
              <Text className="font-title text-error">Log Out</Text>
            </Pressable>
          </View>
        </Animated.View>
        <Pressable accessibilityLabel="Close menu" className="flex-1" onPress={onClose} />
      </View>
    </Modal>
  );
}
