import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import Avatar from '@/components/Avatar';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import PillButton from '@/components/PillButton';
import { useMyBadges } from '@/services/useBadges';
import { useProfileScore } from '@/services/useLeaderboards';
import { signOut } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const ENTRY_LINKS: { label: string; href: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Friends', href: '/friends', icon: 'people-outline' },
  { label: 'Communities', href: '/communities', icon: 'groups' },
  { label: 'Leaderboards', href: '/leaderboards', icon: 'emoji-events' },
  { label: 'Competitions', href: '/voting', icon: 'military-tech' },
  { label: 'Inbox', href: '/inbox', icon: 'mail-outline' },
];

export default function SessionScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const profileScoreQuery = useProfileScore(user?.id ?? '', !!user);
  const badgesQuery = useMyBadges();

  const onLogout = async () => {
    await dispatch(signOut());
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="mb-6 items-center">
          <Avatar username={user.username} avatarUrl={user.avatarUrl} size="xl" />
          <Text accessibilityRole="header" className="mt-3 font-heading text-2xl text-heading">
            {user.username}
          </Text>
          <Text className="font-body text-sm text-ink-muted">{user.email}</Text>
          {user.bio ? (
            <Text className="mt-2 text-center font-body text-sm text-ink">{user.bio}</Text>
          ) : null}
        </View>

        <View className="mb-6 items-center rounded-card border border-outline-variant/30 bg-surface py-4">
          <Text className="font-label text-xs uppercase tracking-wide text-ink-muted">Meme Score</Text>
          {profileScoreQuery.isLoading ? (
            <ActivityIndicator className="mt-2" color="#e3bdc5" />
          ) : (
            <Text className="mt-1 font-heading text-3xl text-heading">
              {profileScoreQuery.data?.score ?? 0}
            </Text>
          )}
        </View>

        <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">Badges</Text>
        {badgesQuery.isLoading ? (
          <ActivityIndicator className="mb-6" color="#e3bdc5" />
        ) : (badgesQuery.data ?? []).length === 0 ? (
          <Text className="mb-6 font-body text-sm text-ink-muted">
            No badges yet — win a challenge to earn one.
          </Text>
        ) : (
          <View className="mb-6 flex-row flex-wrap gap-2">
            {badgesQuery.data?.map((badge) => (
              <View
                key={badge.id}
                className="flex-row items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-2">
                <MaterialIcons name="emoji-events" size={16} color="#ffb1c4" />
                <Text className="font-title text-xs text-primary-dim">
                  {badge.label} · +{badge.points}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="mb-6 gap-2">
          {ENTRY_LINKS.map((link) => (
            <Pressable
              key={link.href}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              onPress={() => router.push(link.href as never)}
              className="min-h-[52px] flex-row items-center justify-between rounded-card border border-outline-variant/30 bg-surface px-4">
              <View className="flex-row items-center gap-3">
                <MaterialIcons name={link.icon} size={20} color="#e3bdc5" />
                <Text className="font-title text-heading">{link.label}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#aa888f" />
            </Pressable>
          ))}
        </View>

        <PillButton label="Log Out" variant="outline" onPress={onLogout} />
      </ScrollView>

      <FloatingBottomNav active="profile" />
    </SafeAreaView>
  );
}
