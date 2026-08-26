import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import PillButton from '@/components/PillButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import TopBar from '@/components/TopBar';
import { getAvatarPreset } from '@/constants/avatarPresets';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { ChallengeRow } from '@/features/challenges/components/ChallengeRow';
import { AddCommunityTemplateModal } from '@/features/communities/components/AddCommunityTemplateModal';
import { EditCommunityBannerModal } from '@/features/communities/components/EditCommunityBannerModal';
import { EditCommunityIconModal } from '@/features/communities/components/EditCommunityIconModal';
import { JoinRequestRow } from '@/features/communities/components/JoinRequestRow';
import { MemberRow } from '@/features/communities/components/MemberRow';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import { IndividualLeaderboardRow } from '@/features/leaderboards/components/IndividualLeaderboardRow';
import type { RootState } from '@/store/store';
import { timeAgo } from '@/utils/timeAgo';
import {
  useApproveJoinRequestMutation,
  useCommunity,
  useJoinCommunityMutation,
  useJoinRequests,
  useLeaveCommunityMutation,
  useMembers,
  useRejectJoinRequestMutation,
} from '@/services/useCommunities';
import { useCommunityFeed } from '@/services/useMemes';
import { useInternalCommunityLeaderboard } from '@/services/useLeaderboards';
import { useCommunityChallenges } from '@/services/useChallenges';
import { useCommunityTemplates } from '@/services/useTemplates';
import type { MemeResponse } from '@/services/memes';

interface CommunityDetailScreenProps {
  communityId: string;
}

type Tab = 'feed' | 'members' | 'leaderboard' | 'challenges' | 'templates';

// Header identity-block sizing — pulled out as named constants (rather than left inline)
// specifically so this is easy to inspect/tweak in isolation if the layout still looks wrong:
// bump `ICON_SIZE`/`ICON_OVERLAP_FRACTION` to see the overlap amount change, or temporarily
// set `DEBUG_HEADER_OUTLINES` (search below) to confirm each block is actually taking up the
// space it's supposed to.
const COVER_ASPECT_RATIO = 16 / 9; // Facebook mobile's cover-photo aspect ratio
const ICON_SIZE = 88; // Instagram-mobile-style profile picture, 1:1 crop
const ICON_OVERLAP_FRACTION = 0.5; // how far the icon overlaps up into the cover photo

export default function CommunityDetailScreen({ communityId }: CommunityDetailScreenProps) {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editBannerOpen, setEditBannerOpen] = useState(false);
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  // Explicit pixel height computed from the actual screen width, not a bare `aspectRatio`
  // style — `aspectRatio` alone can fail to resolve a height at all inside a `FlatList`
  // `ListHeaderComponent` on the first layout pass (a known RN/Yoga edge case), which is
  // what was collapsing the whole header. `useWindowDimensions` is available immediately,
  // no layout round-trip needed.
  const { width: screenWidth } = useWindowDimensions();
  const coverHeight = Math.round(screenWidth / COVER_ASPECT_RATIO);
  const iconOverlap = Math.round(ICON_SIZE * ICON_OVERLAP_FRACTION);

  const communityQuery = useCommunity(communityId);
  const membersQuery = useMembers(communityId);
  const joinCommunity = useJoinCommunityMutation(communityId);
  const leaveCommunity = useLeaveCommunityMutation(communityId);

  const community = communityQuery.data;
  const isOwner = !!community && !!currentUser && community.owner.id === currentUser.id;
  const isMember = community?.viewer_membership_status === 'active';

  const joinRequestsQuery = useJoinRequests(communityId, isOwner);
  const approveRequest = useApproveJoinRequestMutation(communityId);
  const rejectRequest = useRejectJoinRequestMutation(communityId);
  const pendingRequestCount = joinRequestsQuery.data?.length ?? 0;

  const feedQuery = useCommunityFeed(communityId, isMember && activeTab === 'feed');
  const memes: MemeResponse[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const leaderboardQuery = useInternalCommunityLeaderboard(
    communityId,
    isMember && activeTab === 'leaderboard'
  );
  const leaderboardEntries = leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Fetched eagerly (not just on the Challenges tab) whenever the community summary says a
  // challenge is live, so the Feed tab's active-challenge banner below has data to show without
  // waiting for the user to tap into the Challenges tab first — that tap-first requirement was
  // exactly why challenges were going unnoticed. Falls back to tab-gated fetching otherwise.
  const challengesQuery = useCommunityChallenges(
    communityId,
    isMember && (activeTab === 'challenges' || community?.has_active_challenge === true)
  );
  const activeChallenge = challengesQuery.data?.find((c) => c.status === 'active');

  const templatesQuery = useCommunityTemplates(communityId, isMember && activeTab === 'templates');
  const templates = templatesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (communityQuery.isLoading || !community) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        {communityQuery.isError ? (
          <Text className="px-6 text-center font-body text-sm text-error">
            {communityQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator color={c.inkMuted} />
        )}
      </SafeAreaView>
    );
  }

  // Owner-only: pending join requests live inside `header` below (visible on every tab once
  // scrolled to top), but an owner deep in a long feed/leaderboard list has no way to know a
  // request is waiting without scrolling back up. This badge stays pinned in the TopBar across
  // every tab so moderation stays visible without competing with the feed/challenges content for
  // top-of-screen space. Tapping it jumps to the Members tab, whose header remount lands the
  // owner back at the join-requests block.
  const pendingRequestsBadge =
    isOwner && pendingRequestCount > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pendingRequestCount} pending join request${pendingRequestCount === 1 ? '' : 's'}`}
        onPress={() => setActiveTab('members')}
        className="h-11 min-w-[44px] flex-row items-center justify-center gap-1 rounded-full bg-primary/20 px-3">
        <MaterialIcons name="person-add-alt" size={16} color={c.primaryDim} />
        <Text className="font-label text-xs text-primary-dim">{pendingRequestCount}</Text>
      </Pressable>
    ) : null;

  const renderActionButton = () => {
    if (isOwner) {
      return (
        <View className="items-center rounded-full border border-outline py-3">
          <Text className="font-title text-heading">You own this community</Text>
        </View>
      );
    }

    if (community.viewer_membership_status === 'active') {
      return (
        <PillButton
          label={leaveCommunity.isPending ? 'Leaving…' : 'Leave Community'}
          variant="outline"
          onPress={() => leaveCommunity.mutate()}
          loading={leaveCommunity.isPending}
        />
      );
    }

    if (community.viewer_membership_status === 'pending') {
      return (
        <View className="items-center rounded-full bg-surface-high py-3">
          <Text className="font-title text-ink-muted">Request Pending</Text>
        </View>
      );
    }

    return (
      <PillButton
        label={community.privacy === 'open' ? 'Join Community' : 'Request to Join'}
        onPress={() => joinCommunity.mutate()}
        loading={joinCommunity.isPending}
      />
    );
  };

  const iconPreset = getAvatarPreset(community.icon_preset);

  const header = (
    <View className="relative">
      {/* Cover photo — full-bleed, explicit height (see `coverHeight` above), Facebook
          mobile's cover-photo aspect ratio. Owner taps it to change; non-owners see it as
          plain decoration. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOwner ? 'Change cover photo' : 'Cover photo'}
        disabled={!isOwner}
        onPress={() => setEditBannerOpen(true)}
        style={{ width: '100%', height: coverHeight }}
        className="bg-surface-high">
        {community.banner_url ? (
          <Image source={{ uri: community.banner_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="flex-1 bg-primary-container/20" />
        )}
        {isOwner ? (
          <View className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full bg-black/50">
            <MaterialIcons name="photo-camera" size={16} color={c.white} />
          </View>
        ) : null}
      </Pressable>

      {/* Profile picture — absolutely positioned so its overlap onto the cover photo is a
          fixed, deterministic offset from the cover's own (now-explicit) height, rather than
          a negative margin fighting the cover's layout for space. Instagram-mobile-style 1:1
          crop. Own ring (`border-bg`) separates it from the cover photo behind it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOwner ? 'Change community photo' : 'Community photo'}
        disabled={!isOwner}
        onPress={() => setEditIconOpen(true)}
        style={{ position: 'absolute', top: coverHeight - iconOverlap, left: 24 }}>
        <View
          style={{ height: ICON_SIZE, width: ICON_SIZE, borderRadius: ICON_SIZE / 2 }}
          className="overflow-hidden border-4 border-bg">
          {community.icon_url ? (
            <Image source={{ uri: community.icon_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : iconPreset ? (
            <LinearGradient
              colors={iconPreset.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40 }}>{iconPreset.emoji}</Text>
            </LinearGradient>
          ) : (
            <View className="flex-1 items-center justify-center bg-primary-container">
              <Text className="font-heading text-2xl text-white">
                {community.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        {isOwner ? (
          <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-primary-container">
            <MaterialIcons name="photo-camera" size={14} color={c.white} />
          </View>
        ) : null}
      </Pressable>

      <View className="px-6 pt-4">
        {/* Spacer reserving exactly the icon's overlap amount, so the name/pill/description
            below start right under the icon instead of being covered by it (the icon itself
            is absolutely positioned above and takes no layout space here). */}
        <View style={{ height: iconOverlap }} />

        <View className="mb-4 mt-3">
          <Text className="font-heading text-xl text-heading">{community.name}</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full bg-surface-high px-3 py-1">
              <Text className="font-label text-xs text-ink-muted">
                {community.privacy === 'open' ? 'Open' : 'Invite only'}
              </Text>
            </View>
            <Text className="font-body text-sm text-ink-muted">
              {community.member_count} member{community.member_count === 1 ? '' : 's'}
            </Text>
          </View>
          {community.description ? (
            <Text className="mt-2 font-body text-ink">{community.description}</Text>
          ) : null}
        </View>

        <View className="mb-6">{renderActionButton()}</View>

      {/* Surfaces a live challenge on the Feed tab (the default landing tab) instead of
          requiring a tap into the Challenges chip to discover one exists — that tap-first
          requirement was the actual reason challenges were going unnoticed by members. */}
      {isMember && activeTab === 'feed' && activeChallenge ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Active challenge: ${activeChallenge.title}, ${activeChallenge.sides
            .map((s) => s.name)
            .join(' vs ')}, ends in ${timeAgo(activeChallenge.end_time)}`}
          onPress={() =>
            router.push({
              pathname: '/communities/[id]/challenges/[challengeId]',
              params: { id: community.id, challengeId: activeChallenge.id },
            })
          }
          className="mb-6 flex-row items-center gap-3 rounded-card border border-tertiary/40 bg-tertiary/15 p-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-tertiary">
            <MaterialIcons name="bolt" size={20} color={c.white} />
          </View>
          <View className="flex-1">
            <Text className="font-title text-sm text-heading">
              Active: {activeChallenge.title}
            </Text>
            <Text className="font-body text-xs text-ink-muted">
              {activeChallenge.sides.map((s) => s.name).join(' vs ')} · Ends in{' '}
              {timeAgo(activeChallenge.end_time)}
            </Text>
          </View>
          <Text className="font-title text-sm text-tertiary">Compete →</Text>
        </Pressable>
      ) : null}

      {isOwner ? (
        <View className="mb-6">
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="font-label text-xs uppercase tracking-wide text-ink-muted">
              Join requests
            </Text>
            {(joinRequestsQuery.data ?? []).length > 0 ? (
              <View className="rounded-full bg-primary/20 px-2 py-0.5">
                <Text className="font-label text-xs text-primary-dim">
                  {joinRequestsQuery.data?.length} Pending
                </Text>
              </View>
            ) : null}
          </View>
          {joinRequestsQuery.isLoading ? (
            <ActivityIndicator color={c.inkMuted} />
          ) : joinRequestsQuery.isError ? (
            <Text className="font-body text-sm text-error">{joinRequestsQuery.error?.message}</Text>
          ) : (joinRequestsQuery.data ?? []).length === 0 ? (
            <Text className="font-body text-sm text-ink-muted">No pending requests</Text>
          ) : (
            joinRequestsQuery.data?.map((request) => (
              <JoinRequestRow
                key={request.id}
                request={request}
                isPending={approveRequest.isPending || rejectRequest.isPending}
                onApprove={() => approveRequest.mutate(request.id)}
                onReject={() => rejectRequest.mutate(request.id)}
              />
            ))
          )}
        </View>
      ) : null}

      {isMember ? (
        <SegmentedControl
          options={[
            { key: 'feed', label: 'Feed' },
            { key: 'members', label: 'Members' },
            { key: 'leaderboard', label: 'Leaderboard' },
            { key: 'challenges', label: 'Challenges' },
            { key: 'templates', label: 'Templates' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      ) : null}

      {isMember && activeTab === 'feed' ? (
        <PillButton
          label="+ Post"
          onPress={() =>
            router.push({
              pathname: '/new-post',
              params: { communityId: community.id, communityName: community.name },
            })
          }
          className="mb-4 self-start"
        />
      ) : null}

      {isMember && activeTab === 'challenges' && isOwner ? (
        <View className="mb-4 flex-row gap-3">
          <PillButton
            label="Team"
            accessibilityLabel="Start a team challenge"
            className="flex-1"
            onPress={() =>
              router.push({
                pathname: '/communities/[id]/challenges/new',
                params: { id: community.id },
              })
            }
          />
          <PillButton
            label="Community"
            accessibilityLabel="Challenge another community"
            className="flex-1"
            onPress={() =>
              router.push({
                pathname: '/communities/[id]/challenges/vs',
                params: { id: community.id },
              })
            }
          />
        </View>
      ) : null}

      {isMember && activeTab === 'templates' ? (
        <PillButton
          label="+ Add Template"
          accessibilityLabel="Add a template to this community"
          onPress={() => setAddTemplateOpen(true)}
          className="mb-4"
        />
      ) : null}
      </View>

      <EditCommunityIconModal
        visible={editIconOpen}
        onClose={() => setEditIconOpen(false)}
        communityId={community.id}
        hasIcon={!!community.icon_url || !!community.icon_preset}
      />
      <EditCommunityBannerModal
        visible={editBannerOpen}
        onClose={() => setEditBannerOpen(false)}
        communityId={community.id}
        hasBanner={!!community.banner_url}
      />
    </View>
  );

  if (isMember && activeTab === 'feed') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <MemeFeedList
          memes={memes}
          isLoading={feedQuery.isLoading}
          isError={feedQuery.isError}
          errorMessage={feedQuery.error?.message}
          hasNextPage={feedQuery.hasNextPage}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          onEndReached={() => feedQuery.fetchNextPage()}
          isRefetching={feedQuery.isRefetching}
          onRefresh={() => feedQuery.refetch()}
          emptyMessage="No posts in this community yet"
          ListHeaderComponent={header}
        />
      </SafeAreaView>
    );
  }

  if (isMember && activeTab === 'leaderboard') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <FlatList
          data={leaderboardEntries}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => (
            <IndividualLeaderboardRow entry={item} isViewer={item.user.id === currentUser?.id} />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 40 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (leaderboardQuery.hasNextPage && !leaderboardQuery.isFetchingNextPage) {
              leaderboardQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={leaderboardQuery.isRefetching}
              onRefresh={() => leaderboardQuery.refetch()}
            />
          }
          ListFooterComponent={
            leaderboardQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color={c.inkMuted} /> : null
          }
          ListEmptyComponent={
            leaderboardQuery.isLoading ? (
              <ActivityIndicator className="my-8" color={c.inkMuted} />
            ) : leaderboardQuery.isError ? (
              <Text className="mx-6 font-body text-sm text-error">{leaderboardQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center font-body text-sm text-ink-muted">
                No scores yet in this community
              </Text>
            )
          }
        />
      </SafeAreaView>
    );
  }

  if (isMember && activeTab === 'challenges') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <ScrollView className="flex-1">
          {header}
          <View className="px-6 pb-6">
            {challengesQuery.isLoading ? (
              <ActivityIndicator className="my-4" color={c.inkMuted} />
            ) : challengesQuery.isError ? (
              <Text className="font-body text-sm text-error">{challengesQuery.error?.message}</Text>
            ) : (challengesQuery.data ?? []).length === 0 ? (
              <Text className="font-body text-sm text-ink-muted">No challenges yet</Text>
            ) : (
              challengesQuery.data?.map((challenge) => (
                <ChallengeRow
                  key={challenge.id}
                  challenge={challenge}
                  onPress={() =>
                    router.push({
                      pathname: '/communities/[id]/challenges/[challengeId]',
                      params: { id: community.id, challengeId: challenge.id },
                    })
                  }
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isMember && activeTab === 'templates') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          numColumns={3}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (templatesQuery.hasNextPage && !templatesQuery.isFetchingNextPage) {
              templatesQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={templatesQuery.isRefetching}
              onRefresh={() => templatesQuery.refetch()}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Create a meme with ${item.name}`}
              onPress={() =>
                router.push({
                  pathname: '/new-post',
                  params: {
                    communityId: community.id,
                    communityName: community.name,
                    templateUrl: item.image_url,
                  },
                })
              }
              className="m-1 aspect-square flex-1 overflow-hidden rounded-card border border-outline-variant/30">
              <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </Pressable>
          )}
          ListFooterComponent={
            templatesQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" color={c.inkMuted} /> : null
          }
          ListEmptyComponent={
            templatesQuery.isLoading ? (
              <ActivityIndicator className="mt-8" color={c.inkMuted} />
            ) : templatesQuery.isError ? (
              <Text className="mx-6 mt-8 text-center font-body text-sm text-error">
                {templatesQuery.error?.message}
              </Text>
            ) : (
              <Text className="mx-6 mt-8 text-center font-body text-sm text-ink-muted">
                No templates in this community yet — add the first one
              </Text>
            )
          }
        />
        <AddCommunityTemplateModal
          visible={addTemplateOpen}
          onClose={() => setAddTemplateOpen(false)}
          communityId={community.id}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
      <ScrollView className="flex-1">
        {header}
        <View className="px-6 pb-6">
          <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">Members</Text>
          {membersQuery.isLoading ? (
            <ActivityIndicator color={c.inkMuted} />
          ) : membersQuery.isError ? (
            <Text className="font-body text-sm text-ink-muted">{membersQuery.error?.message}</Text>
          ) : (
            membersQuery.data?.map((member) => <MemberRow key={member.id} membership={member} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
