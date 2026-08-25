import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import FloatingBottomNav from '@/components/FloatingBottomNav';
import PillButton from '@/components/PillButton';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { EmailVerificationBanner } from '@/features/auth/EmailVerificationBanner';
import type { BadgeResponse } from '@/services/badges';
import type { MemeResponse } from '@/services/memes';
import { useSendFriendRequestMutation } from '@/services/useFriends';
import { useUserPosts, useUserProfile } from '@/services/useProfiles';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

interface ProfileScreenProps {
  userId: string;
  isOwnProfile: boolean;
}

const MAX_VISIBLE_BADGES = 3;

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center px-2">
      <Text className="font-heading text-xl text-heading">{value}</Text>
      <Text className="font-label text-[10px] uppercase tracking-wide text-ink-muted">{label}</Text>
    </View>
  );
}

function BadgesRow({ badges }: { badges: BadgeResponse[] }) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  if (badges.length === 0) return null;
  const visible = badges.slice(0, MAX_VISIBLE_BADGES);
  const overflow = badges.length - visible.length;

  return (
    <View className="mt-4 w-full flex-row flex-wrap items-center gap-2">
      {visible.map((badge) => (
        <View key={badge.id} className="flex-row items-center gap-1.5 rounded-full bg-accent-gold px-3 py-1.5">
          <MaterialIcons name="emoji-events" size={14} color={c.onAccentInk} />
          <Text className="font-title text-xs" style={{ color: c.onAccentInk }}>
            {badge.label}
          </Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View className="items-center justify-center rounded-full bg-surface-high px-3 py-1.5">
          <Text className="font-title text-xs text-ink-muted">+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Instagram-style profile: avatar+stats header, badges, then a 3-column grid of the user's own
 * posts — shared between "my profile" (`app/profile.tsx`) and "a friend's profile"
 * (`app/users/[id].tsx`), which is why every own-profile-only affordance (bottom nav, email
 * verification banner) is gated on `isOwnProfile` rather than living in a separate component.
 * Site-navigation links and account settings (Appearance/Log Out) that used to sit here moved to
 * the feed's hamburger `NavDrawer` — see that component. */
export default function ProfileScreen({ userId, isOwnProfile }: ProfileScreenProps) {
  const router = useRouter();
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const sessionUser = useSelector((state: RootState) => state.auth.user);
  const profileQuery = useUserProfile(userId);
  const postsUnlocked = !!profileQuery.data && !profileQuery.data.posts_locked;
  const postsQuery = useUserPosts(userId, postsUnlocked);
  const sendFriendRequest = useSendFriendRequestMutation();
  const [requestSent, setRequestSent] = useState(false);

  const posts: MemeResponse[] = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={c.inkMuted} />
      </SafeAreaView>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title="Profile" showBack={!isOwnProfile} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-body text-sm text-error">
            {profileQuery.error?.message ?? 'Could not load this profile.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;

  const onAddFriend = () => {
    sendFriendRequest.mutate(
      { username: profile.user.username },
      { onSuccess: () => setRequestSent(true) }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={profile.user.username} showBack={!isOwnProfile} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: 100 }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <View className="px-6 pb-4 pt-4">
            <View className="flex-row items-center">
              <Avatar username={profile.user.username} avatarUrl={profile.user.avatar_url} size="xl" />
              <View className="ml-5 flex-1 flex-row items-center justify-around rounded-card border border-outline-variant/30 bg-surface py-3">
                <StatCell label="Meme Score" value={profile.score} />
                <StatCell label="Badges" value={profile.badge_count} />
                <StatCell label="Friends" value={profile.friend_count} />
              </View>
            </View>

            {profile.user.bio ? (
              <Text className="mt-3 font-body text-sm text-ink">{profile.user.bio}</Text>
            ) : null}

            {isOwnProfile && sessionUser && !sessionUser.emailVerifiedAt ? (
              <View className="mt-3 w-full">
                <EmailVerificationBanner />
              </View>
            ) : null}

            <BadgesRow badges={profile.badges} />

            {!isOwnProfile ? (
              profile.is_friend ? (
                <PillButton
                  label="Message"
                  variant="outline"
                  onPress={() => router.push('/inbox')}
                  className="mt-4 w-full"
                />
              ) : (
                <PillButton
                  label={
                    requestSent
                      ? 'Request Sent'
                      : sendFriendRequest.isPending
                        ? 'Sending…'
                        : 'Add Friend'
                  }
                  onPress={onAddFriend}
                  disabled={requestSent || sendFriendRequest.isPending}
                  loading={sendFriendRequest.isPending}
                  className="mt-4 w-full"
                />
              )
            ) : null}
            {sendFriendRequest.isError ? (
              <Text className="mt-2 font-body text-xs text-error">{sendFriendRequest.error.message}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.caption ?? `Open post by ${item.author.username}`}
            onPress={() => router.push({ pathname: '/memes/[id]', params: { id: item.id } })}
            className="aspect-square flex-1 m-[1px]">
            <Image
              source={{ uri: item.image_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </Pressable>
        )}
        ListEmptyComponent={
          profile.posts_locked ? (
            <View className="items-center px-8 py-10">
              <MaterialIcons name="lock-outline" size={28} color={c.inkMuted} />
              <Text className="mt-2 text-center font-body text-sm text-ink-muted">
                Add {profile.user.username} as a friend to see their posts.
              </Text>
            </View>
          ) : postsQuery.isLoading ? (
            <ActivityIndicator className="mt-8" color={c.inkMuted} />
          ) : postsQuery.isError ? (
            <Text className="mt-8 text-center font-body text-sm text-error">
              {postsQuery.error?.message}
            </Text>
          ) : (
            <Text className="mt-8 text-center font-body text-sm text-ink-muted">No posts yet</Text>
          )
        }
      />

      {isOwnProfile ? <FloatingBottomNav active="profile" /> : null}
    </SafeAreaView>
  );
}
