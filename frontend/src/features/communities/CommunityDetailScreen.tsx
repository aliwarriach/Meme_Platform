import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeMode } from '@/constants/ThemeMode';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { KeyboardAwareForm } from '@/components/KeyboardAvoidingScreen';
import PillButton from '@/components/PillButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import TopBar from '@/components/TopBar';
import { getAvatarPreset } from '@/constants/avatarPresets';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { ChallengeRow } from '@/features/challenges/components/ChallengeRow';
import { AddCommunityTemplateModal } from '@/features/communities/components/AddCommunityTemplateModal';
import { AddMembersModal } from '@/features/communities/components/AddMembersModal';
import { CommunityRequestsModal } from '@/features/communities/components/CommunityRequestsModal';
import { DeleteTemplateConfirmModal } from '@/features/communities/components/DeleteTemplateConfirmModal';
import { EditCommunityBannerModal } from '@/features/communities/components/EditCommunityBannerModal';
import { EditCommunityIconModal } from '@/features/communities/components/EditCommunityIconModal';
import { MemberRow } from '@/features/communities/components/MemberRow';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import { IndividualLeaderboardRow } from '@/features/leaderboards/components/IndividualLeaderboardRow';
import type { RootState } from '@/store/store';
import { timeAgo } from '@/utils/timeAgo';
import {
  useCommunity,
  useJoinCommunityMutation,
  useJoinRequests,
  useLeaveCommunityMutation,
  useMembers,
} from '@/services/useCommunities';
import { useCommunityFeed } from '@/services/useMemes';
import { useInternalCommunityLeaderboard } from '@/services/useLeaderboards';
import { useCommunityChallenges } from '@/services/useChallenges';
import { useCommunityTemplates } from '@/services/useTemplates';
import type { MemeResponse } from '@/services/memes';
import type { TemplateResponse } from '@/services/templates';

interface CommunityDetailScreenProps {
  communityId: string;
}

type Tab = 'feed' | 'members' | 'leaderboard' | 'challenges' | 'templates';

// Header identity-block sizing — pulled out as named constants (rather than left inline)
// specifically so this is easy to inspect/tweak in isolation if the layout still looks wrong:
// bump `ICON_SIZE`/`ICON_OVERLAP_FRACTION` to see the overlap amount change, or temporarily
// set `DEBUG_HEADER_OUTLINES` (search below) to confirm each block is actually taking up the
// space it's supposed to.
// Wider (shorter) than Facebook mobile's literal 16:9 — the cover was still taking up too
// much of the screen at 2.2:1 by the user's own follow-up report; 3:1 keeps the same
// full-bleed width but shortens it further still.
const COVER_ASPECT_RATIO = 3;
const ICON_SIZE = 108; // Instagram-mobile-style profile picture, 1:1 crop — bumped up from 88,
// it read as small next to the rest of the header at that size.
const ICON_OVERLAP_FRACTION = 0.5; // how far the icon overlaps up into the cover photo

export default function CommunityDetailScreen({ communityId }: CommunityDetailScreenProps) {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  // `openRequests=1` (set by the "New join request" notification tap, NotificationsScreen.tsx)
  // lands the owner straight on the same Members-tab-plus-requests-sheet state the pending-
  // requests badge already opens below — the notification's whole point is "come approve this,"
  // so it should reach exactly that state, not just the community's default Feed tab.
  const { tab: tabParam, openRequests } = useLocalSearchParams<{
    tab?: string;
    openRequests?: string;
  }>();
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === 'members' ? 'members' : 'feed');
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateResponse | null>(null);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [editBannerOpen, setEditBannerOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  // Initialized (not effect-driven) from the same `openRequests` param — `CommunityRequestsModal`
  // is already owner-gated server-side (a non-owner gets a normal inline error, never a crash),
  // so there's no need to wait on `isOwner` resolving before deciding this initial value.
  const [requestsOpen, setRequestsOpen] = useState(openRequests === '1');
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [appliedMemberSearch, setAppliedMemberSearch] = useState('');
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
  // A non-member can still browse an **open** community's tabs read-only — Feed (no
  // posting), Members (list only, no Add/Requests/search), Leaderboard (unrestricted),
  // Challenges (community-vs-community only, never team challenges, no creating a new one).
  // Templates stay hidden from a non-member no matter what (never included in `showTabs`'s
  // options list below). An invite-only community shows nothing beyond the header/join
  // button to a non-member, unchanged from before.
  const canPreview = !!community && community.privacy === 'open' && !isMember;
  const showTabs = isMember || canPreview;

  const joinRequestsQuery = useJoinRequests(communityId, isOwner);
  const pendingRequestCount = joinRequestsQuery.data?.length ?? 0;

  const feedQuery = useCommunityFeed(communityId, showTabs && activeTab === 'feed');
  const memes: MemeResponse[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const leaderboardQuery = useInternalCommunityLeaderboard(
    communityId,
    showTabs && activeTab === 'leaderboard'
  );
  const leaderboardEntries = leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Fetched eagerly (not just on the Challenges tab) whenever the community summary says a
  // challenge is live, so the Feed tab's active-challenge banner below has data to show without
  // waiting for the user to tap into the Challenges tab first — that tap-first requirement was
  // exactly why challenges were going unnoticed. Falls back to tab-gated fetching otherwise.
  const challengesQuery = useCommunityChallenges(
    communityId,
    showTabs && (activeTab === 'challenges' || community?.has_active_challenge === true)
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

  // Owner-only: pending join requests live in `CommunityRequestsModal` now (off the Members
  // tab's "Requests" button), but an owner deep in a long feed/leaderboard list has no
  // persistent signal a request is waiting. This badge stays pinned in the TopBar across every
  // tab — tapping it jumps to the Members tab and opens the requests sheet directly.
  const pendingRequestsBadge =
    isOwner && pendingRequestCount > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pendingRequestCount} pending join request${pendingRequestCount === 1 ? '' : 's'}`}
        onPress={() => {
          setActiveTab('members');
          setRequestsOpen(true);
        }}
        className="h-11 min-w-[44px] flex-row items-center justify-center gap-1 rounded-full bg-primary/20 px-3">
        <MaterialIcons name="person-add-alt" size={16} color={c.primaryDim} />
        <Text className="font-label text-xs text-primary-dim">{pendingRequestCount}</Text>
      </Pressable>
    ) : null;

  const renderActionButton = () => {
    // Owner sees no action button here at all — "You own this community" was a large,
    // purely-informational block taking up prime header space for a fact the owner already
    // knows; removed outright rather than replaced with anything.
    if (isOwner) return null;

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

    if (community.viewer_membership_status === 'invited') {
      return (
        <View className="flex-row gap-3">
          <PillButton
            label={joinCommunity.isPending ? 'Joining…' : 'Accept Invite'}
            className="flex-1"
            onPress={() => joinCommunity.mutate()}
            loading={joinCommunity.isPending}
          />
          <PillButton
            label="Decline"
            variant="outline"
            className="flex-1"
            onPress={() => leaveCommunity.mutate()}
            loading={leaveCommunity.isPending}
          />
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
          <Text className="font-heading text-2xl text-heading">{community.name}</Text>
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

        {isOwner ? null : <View className="mb-6">{renderActionButton()}</View>}

      {/* Surfaces a live challenge on the Feed tab (the default landing tab) instead of
          requiring a tap into the Challenges chip to discover one exists — that tap-first
          requirement was the actual reason challenges were going unnoticed by members. */}
      {showTabs && activeTab === 'feed' && activeChallenge ? (
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

      {showTabs ? (
        <SegmentedControl
          options={
            isMember
              ? [
                  { key: 'feed', label: 'Feed' },
                  { key: 'members', label: 'Members' },
                  { key: 'leaderboard', label: 'Leaderboard' },
                  { key: 'challenges', label: 'Challenges' },
                  { key: 'templates', label: 'Templates' },
                ]
              : // Non-member preview of an open community — Templates never shows here,
                // regardless of anything else.
                [
                  { key: 'feed', label: 'Feed' },
                  { key: 'members', label: 'Members' },
                  { key: 'leaderboard', label: 'Leaderboard' },
                  { key: 'challenges', label: 'Challenges' },
                ]
          }
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
      <AddMembersModal
        visible={addMembersOpen}
        onClose={() => setAddMembersOpen(false)}
        communityId={community.id}
      />
      {isOwner ? (
        <CommunityRequestsModal
          visible={requestsOpen}
          onClose={() => setRequestsOpen(false)}
          communityId={community.id}
        />
      ) : null}
    </View>
  );

  if (showTabs && activeTab === 'feed') {
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

  if (showTabs && activeTab === 'leaderboard') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <FlatList
          key="leaderboard-list"
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

  if (showTabs && activeTab === 'challenges') {
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
          key="templates-grid"
          data={templates}
          keyExtractor={(item) => item.id}
          numColumns={3}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 40 }}
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
              {isOwner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    setTemplateToDelete(item);
                  }}
                  className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60">
                  <MaterialIcons name="delete-outline" size={16} color="#FFFFFF" />
                </Pressable>
              ) : null}
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
        <DeleteTemplateConfirmModal
          communityId={community.id}
          template={templateToDelete}
          onClose={() => setTemplateToDelete(null)}
        />
      </SafeAreaView>
    );
  }

  const visibleMembers = (membersQuery.data ?? []).filter((member) =>
    member.user.username.toLowerCase().includes(appliedMemberSearch.trim().toLowerCase())
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
      <KeyboardAwareForm className="flex-1">
        {header}
        <View className="px-6 pb-6">
          {isMember ? (
            <>
              <View className="mb-3 flex-row gap-3">
                <PillButton
                  label="Add"
                  accessibilityLabel="Add members"
                  className="flex-1"
                  onPress={() => setAddMembersOpen(true)}
                />
                {isOwner ? (
                  <PillButton
                    label={pendingRequestCount > 0 ? `Requests (${pendingRequestCount})` : 'Requests'}
                    accessibilityLabel="View join requests"
                    className="flex-1"
                    onPress={() => setRequestsOpen(true)}
                  />
                ) : null}
              </View>

              <View className="mb-4 flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2">
                  <MaterialIcons name="search" size={18} color={c.inkMuted} />
                  <TextInput
                    value={memberSearchInput}
                    onChangeText={setMemberSearchInput}
                    onSubmitEditing={() => setAppliedMemberSearch(memberSearchInput)}
                    placeholder="Search members"
                    placeholderTextColor={c.outline}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    className="flex-1 py-1 font-body text-base text-heading"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search members"
                  onPress={() => setAppliedMemberSearch(memberSearchInput)}
                  className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
                  <MaterialIcons name="search" size={18} color={c.white} />
                </Pressable>
              </View>
            </>
          ) : null}

          <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">Members</Text>
          {membersQuery.isLoading ? (
            <ActivityIndicator color={c.inkMuted} />
          ) : membersQuery.isError ? (
            <Text className="font-body text-sm text-ink-muted">{membersQuery.error?.message}</Text>
          ) : visibleMembers.length === 0 ? (
            <Text className="font-body text-sm text-ink-muted">
              {appliedMemberSearch ? `No members match "${appliedMemberSearch}".` : 'No members yet'}
            </Text>
          ) : (
            visibleMembers.map((member) => <MemberRow key={member.id} membership={member} />)
          )}
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}
