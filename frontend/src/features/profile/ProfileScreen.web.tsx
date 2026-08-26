import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebAvatar from '@/components/web/WebAvatar';
import { WebEmailVerificationBanner } from '@/components/web/WebEmailVerificationBanner';
import WebProfileTopBar from '@/components/web/WebProfileTopBar';
import WebScoreCard from '@/components/web/WebScoreCard';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { BadgeResponse } from '@/services/badges';
import type { MemeResponse } from '@/services/memes';
import { useSendFriendRequestMutation } from '@/services/useFriends';
import { useUserPosts, useUserProfile } from '@/services/useProfiles';
import type { RootState } from '@/store/store';

interface ProfileScreenProps {
  userId: string;
  isOwnProfile: boolean;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

const MAX_VISIBLE_BADGES = 3;

/**
 * Web sibling of `features/profile/ProfileScreen.tsx` (native-resolved, Expo Router's
 * platform-extension resolution prefers this file for the web bundle). Same content shift as
 * native — avatar/stats header, badges, posts grid replaces the flat entry-link list, which moved
 * to the feed's hamburger `NavDrawer` (Appearance/Log Out included) — kept in this screen's own
 * Vaporwave/Luminous visual language rather than reusing native's NativeWind markup, matching
 * every other web-redesigned screen.
 */
export default function ProfileScreen({ userId, isOwnProfile }: ProfileScreenProps) {
  const router = useRouter();
  const { colors, type, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const sessionUser = useSelector((state: RootState) => state.auth.user);
  const profileQuery = useUserProfile(userId);
  const postsUnlocked = !!profileQuery.data && !profileQuery.data.posts_locked;
  const postsQuery = useUserPosts(userId, postsUnlocked);
  const sendFriendRequest = useSendFriendRequestMutation();
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    injectFeedWebFont();
  }, []);

  const posts: MemeResponse[] = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const onAddFriend = () => {
    if (!profileQuery.data) return;
    sendFriendRequest.mutate(
      { username: profileQuery.data.user.username },
      { onSuccess: () => setRequestSent(true) }
    );
  };

  if (profileQuery.isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.foregroundMuted} />
      </View>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <WebProfileTopBar title="Profile" showBack={!isOwnProfile} />
          <View style={[styles.centered, { flex: 1 }]}>
            <Text style={[type.body, { color: colors.error }]}>
              {profileQuery.error?.message ?? 'Could not load this profile.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const profile = profileQuery.data;
  const visibleBadges = profile.badges.slice(0, MAX_VISIBLE_BADGES);
  const overflowBadges = profile.badges.length - visibleBadges.length;

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebProfileTopBar title={profile.user.username} showBack={!isOwnProfile} />

        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          data={posts}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage();
          }}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.identityRow}>
                <WebAvatar
                  username={profile.user.username}
                  avatarUrl={profile.user.avatar_url}
                  avatarPreset={profile.user.avatar_preset}
                  size={88}
                />
                <View style={styles.statsRow}>
                  <WebScoreCard label="Meme Score" value={profile.score} isLoading={false} icon="military-tech" />
                  <WebScoreCard
                    label="Badges"
                    value={profile.badge_count}
                    isLoading={false}
                    icon="emoji-events"
                    accentFill={colors.accentGold}
                    accentText={colors.onAccentInk}
                  />
                  <WebScoreCard
                    label="Friends"
                    value={profile.friend_count}
                    isLoading={false}
                    icon="people"
                    accentFill={colors.accentCyan}
                    accentText={colors.onAccentInk}
                  />
                </View>
              </View>

              {profile.user.bio ? (
                <Text style={[type.body, styles.bio, { color: colors.foreground }]}>{profile.user.bio}</Text>
              ) : null}

              {isOwnProfile && sessionUser && !sessionUser.emailVerifiedAt ? (
                <WebEmailVerificationBanner />
              ) : null}

              {visibleBadges.length > 0 ? (
                <View style={styles.badgesRow}>
                  {visibleBadges.map((badge: BadgeResponse) => (
                    <View key={badge.id} style={[styles.badgeChip, { backgroundColor: colors.accentGold }]}>
                      <MaterialIcons name="emoji-events" size={14} color={colors.onAccentInk} />
                      <Text style={[type.title, styles.badgeText, { color: colors.onAccentInk }]}>{badge.label}</Text>
                    </View>
                  ))}
                  {overflowBadges > 0 ? (
                    <View style={[styles.badgeChip, { backgroundColor: colors.surfaceGlass }]}>
                      <Text style={[type.title, styles.badgeText, { color: colors.foregroundMuted }]}>
                        +{overflowBadges}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {!isOwnProfile ? (
                profile.is_friend ? (
                  <ProfileActionButton
                    label="Message"
                    onPress={() => router.push('/inbox')}
                    colors={colors}
                    type={type}
                    spacing={spacing}
                  />
                ) : (
                  <ProfileActionButton
                    label={requestSent ? 'Request Sent' : sendFriendRequest.isPending ? 'Sending…' : 'Add Friend'}
                    onPress={onAddFriend}
                    disabled={requestSent || sendFriendRequest.isPending}
                    colors={colors}
                    type={type}
                    spacing={spacing}
                  />
                )
              ) : null}
              {sendFriendRequest.isError ? (
                <Text style={[type.meta, styles.errorText, { color: colors.error }]}>
                  {sendFriendRequest.error.message}
                </Text>
              ) : null}

              {profile.posts_locked ? (
                <View style={styles.lockedWrap}>
                  <MaterialIcons name="lock-outline" size={28} color={colors.foregroundMuted} />
                  <Text style={[type.body, styles.lockedText, { color: colors.foregroundMuted }]}>
                    Add {profile.user.username} as a friend to see their posts.
                  </Text>
                </View>
              ) : postsQuery.isLoading ? (
                <ActivityIndicator style={styles.postsSpinner} color={colors.foregroundMuted} />
              ) : postsQuery.isError ? (
                <Text style={[type.body, styles.lockedText, { color: colors.error }]}>
                  {postsQuery.error?.message}
                </Text>
              ) : posts.length === 0 ? (
                <Text style={[type.body, styles.lockedText, { color: colors.foregroundMuted }]}>No posts yet</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.caption ?? `Open post by ${item.author.username}`}
              onPress={() => router.push({ pathname: '/memes/[id]', params: { id: item.id } })}
              style={({ hovered }: WebPressableState) => [styles.gridTile, hovered && { opacity: 0.85 }]}>
              <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          )}
        />
      </SafeAreaView>

      <FloatingBottomNav active="profile" />
    </View>
  );
}

// Small local button — this screen is the only place a Vaporwave-themed "Add Friend"/"Message"
// CTA is needed; not worth promoting to a shared component for one consumer.
function ProfileActionButton({
  label,
  onPress,
  disabled,
  colors,
  type,
  spacing,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: VaporwaveTheme['colors'];
  type: VaporwaveTheme['type'];
  spacing: VaporwaveTheme['spacing'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ hovered }: WebPressableState) => [
        {
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          marginTop: spacing.lg,
          backgroundColor: colors.indigoSecondary,
          opacity: disabled ? 0.5 : hovered ? 0.9 : 1,
        },
      ]}>
      <Text style={[type.title, { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: VaporwaveTheme['colors'], spacing: VaporwaveTheme['spacing']) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    centered: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    header: {
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statsRow: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      marginLeft: spacing.lg,
    },
    bio: {
      marginTop: spacing.md,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    badgeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badgeText: {
      fontSize: 12,
    },
    errorText: {
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    lockedWrap: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
    },
    lockedText: {
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    postsSpinner: {
      marginTop: spacing.xl,
    },
    gridRow: {
      gap: 2,
      paddingHorizontal: spacing.lg,
    },
    gridTile: {
      flex: 1 / 3,
      aspectRatio: 1,
      marginTop: 2,
      backgroundColor: colors.surfaceGlass,
      overflow: 'hidden',
    },
  });
