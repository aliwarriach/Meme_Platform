import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import FloatingBottomNav from '@/components/FloatingBottomNav';
import WebPillButton from '@/components/web/WebPillButton';
import WebCommunityTopBar from '@/components/web/WebCommunityTopBar';
import { WebCommunityFeedCard } from '@/components/web/WebCommunityFeedCard';
import { WebJoinRequestCard } from '@/components/web/WebJoinRequestCard';
import { WebMemberCard } from '@/components/web/WebMemberCard';
import { WebSegmentedControl } from '@/components/web/WebSegmentedControl';
import { CommunityThemeProvider, useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, injectCommunityWebFont, type WebPressableState } from '@/constants/webCommunityTheme';
import { ChallengeRow } from '@/features/challenges/components/ChallengeRow';
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
import { useCommunityChallenges } from '@/services/useChallenges';
import { useInternalCommunityLeaderboard } from '@/services/useLeaderboards';
import { useCommunityFeed } from '@/services/useMemes';
import type { MemeResponse } from '@/services/memes';

interface CommunityDetailScreenProps {
  communityId: string;
}

type Tab = 'feed' | 'members' | 'leaderboard' | 'challenges';

// The reused native `IndividualLeaderboardRow`/`ChallengeRow` (see file header comment) are
// built against MASTER.md's dark-only "Vivid Meme Culture" tokens (white heading text, no light
// variant — MASTER.md is explicit: "this app is dark-only"). Wrapping them in this page's own
// `colors.card` would go white-on-white in light mode. Forcing a fixed dark surface here,
// sourced verbatim from MASTER.md's own `bg`/`surface`/`outline-variant` tokens (not invented),
// keeps those rows exactly as legible as they are natively, independent of this page's toggle.
const MASTER_DARK_SEAM = {
  background: '#1e0f13',
  card: '#2c1b1f',
  border: '#5b3f46',
  inkMuted: '#e3bdc5',
  primary: '#ff3385', // MASTER's neon-pink primary — 4.7:1 on `card` above; this page's own
  // violet primary measures only ~2.9:1 against this fixed dark card, so it is not reused here.
  error: '#ffb4ab', // MASTER's own dark-surface error token — this page's `destructive` red
  // measures only ~3.4:1 against this fixed dark card (fails 4.5:1 body text).
} as const;

/**
 * Web-only sibling of `features/communities/CommunityDetailScreen.tsx` (native-resolved,
 * untouched). Same data/hooks/business logic; new "Vibrant & Block-based" chrome, page-scoped to
 * `design-system/meme-platform/pages/community-web.md`.
 *
 * Feed and Members tabs get the full new visual system (this pass's in-scope surfaces per the
 * task brief: "feed within a community + members + join requests"). Leaderboard and Challenges
 * are explicit scope exclusions — both tabs stay reachable (removing them would be a real
 * functionality regression) but render the native `IndividualLeaderboardRow`/`ChallengeRow`
 * unrestyled inside a themed container, the same "reuse nested UI as-is" precedent
 * `feed-web.md` used for its modals. See community-web.md's "Known seams".
 */
function CommunityDetailScreenContent({ communityId }: CommunityDetailScreenProps) {
  const router = useRouter();
  const { colors } = useCommunityWebTheme();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  useEffect(() => {
    injectCommunityWebFont();
  }, []);

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

  const leaderboardQuery = useInternalCommunityLeaderboard(communityId, isMember && activeTab === 'leaderboard');
  const leaderboardEntries = leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const challengesQuery = useCommunityChallenges(
    communityId,
    isMember && (activeTab === 'challenges' || community?.has_active_challenge === true)
  );
  const activeChallenge = challengesQuery.data?.find((c) => c.status === 'active');

  if (communityQuery.isLoading || !community) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        {communityQuery.isError ? (
          <Text style={[COMMUNITY_WEB_TYPE.body, { color: colors.destructive, textAlign: 'center', paddingHorizontal: 24 }]}>
            {communityQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator color={colors.foregroundMuted} />
        )}
      </View>
    );
  }

  const pendingRequestsBadge =
    isOwner && pendingRequestCount > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pendingRequestCount} pending join request${pendingRequestCount === 1 ? '' : 's'}`}
        onPress={() => setActiveTab('members')}
        style={({ hovered, focused }: WebPressableState) => [
          styles.requestsBadge,
          { backgroundColor: colors.elevated },
          hovered && { backgroundColor: colors.elevatedHover },
          focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 1 },
        ]}>
        <MaterialIcons name="person-add-alt" size={15} color={colors.primary} />
        <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.primary, fontSize: 11 }]}>{pendingRequestCount}</Text>
      </Pressable>
    ) : null;

  const renderActionButton = () => {
    if (isOwner) {
      return (
        <View style={[styles.ownerPill, { borderColor: colors.border }]}>
          <Text style={[COMMUNITY_WEB_TYPE.title, { color: colors.foreground }]}>You own this community</Text>
        </View>
      );
    }
    if (community.viewer_membership_status === 'active') {
      return (
        <WebPillButton
          label={leaveCommunity.isPending ? 'Leaving…' : 'Leave Community'}
          variant="outline"
          onPress={() => leaveCommunity.mutate()}
          loading={leaveCommunity.isPending}
        />
      );
    }
    if (community.viewer_membership_status === 'pending') {
      return (
        <View style={[styles.ownerPill, { backgroundColor: colors.elevated, borderWidth: 0 }]}>
          <Text style={[COMMUNITY_WEB_TYPE.title, { color: colors.foregroundMuted }]}>Request Pending</Text>
        </View>
      );
    }
    return (
      <WebPillButton
        label={community.privacy === 'open' ? 'Join Community' : 'Request to Join'}
        onPress={() => joinCommunity.mutate()}
        loading={joinCommunity.isPending}
      />
    );
  };

  const tabOptions = [
    { key: 'feed' as const, label: 'Feed' },
    { key: 'members' as const, label: 'Members', badge: isOwner && pendingRequestCount > 0 ? pendingRequestCount : undefined },
    { key: 'leaderboard' as const, label: 'Leaderboard' },
    { key: 'challenges' as const, label: 'Challenges' },
  ];

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.headerTop}>
        {community.icon_url ? (
          <Image source={{ uri: community.icon_url }} style={styles.communityIcon} contentFit="cover" />
        ) : (
          <View style={[styles.communityIconFallback, { backgroundColor: colors.primary }]}>
            <Text style={[COMMUNITY_WEB_TYPE.display, { color: colors.onPrimary, fontSize: 28 }]}>
              {community.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[COMMUNITY_WEB_TYPE.display, styles.communityName, { color: colors.foreground }]}>{community.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.elevated }]}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.foregroundMuted, fontSize: 10 }]}>
              {community.privacy === 'open' ? 'Open' : 'Invite only'}
            </Text>
          </View>
          <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
            {community.member_count} member{community.member_count === 1 ? '' : 's'}
          </Text>
        </View>
        {community.description ? (
          <Text style={[COMMUNITY_WEB_TYPE.body, styles.description, { color: colors.foregroundMuted }]}>
            {community.description}
          </Text>
        ) : null}
        <View style={styles.actionButtonWrap}>{renderActionButton()}</View>
      </View>

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
          style={({ hovered }) => [
            styles.challengeBanner,
            { backgroundColor: colors.elevated, borderColor: colors.accent },
            hovered && { borderColor: colors.primary },
          ]}>
          <View style={[styles.challengeIcon, { backgroundColor: colors.accent }]}>
            <MaterialIcons name="bolt" size={18} color={colors.onAccent} />
          </View>
          <View style={styles.flex}>
            <Text style={[COMMUNITY_WEB_TYPE.title, { color: colors.foreground }]}>Active: {activeChallenge.title}</Text>
            <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>
              {activeChallenge.sides.map((s) => s.name).join(' vs ')} · Ends in {timeAgo(activeChallenge.end_time)}
            </Text>
          </View>
          <Text style={[COMMUNITY_WEB_TYPE.title, { color: colors.primary }]}>Compete →</Text>
        </Pressable>
      ) : null}

      {isMember ? (
        <View style={styles.tabsWrap}>
          <WebSegmentedControl options={tabOptions} value={activeTab} onChange={setActiveTab} />
        </View>
      ) : null}

      {isMember && activeTab === 'feed' ? (
        <View style={styles.postButtonWrap}>
          <WebPillButton
            label="+ Post"
            onPress={() =>
              router.push({ pathname: '/new-post', params: { communityId: community.id, communityName: community.name } })
            }
          />
        </View>
      ) : null}

      {isMember && activeTab === 'members' && isOwner ? (
        <View style={styles.joinRequestsBlock}>
          <View style={styles.joinRequestsHeader}>
            <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.foregroundMuted }]}>Join requests</Text>
            {pendingRequestCount > 0 ? (
              <View style={[styles.pendingCountPill, { backgroundColor: colors.elevated }]}>
                <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.primary, fontSize: 10 }]}>
                  {pendingRequestCount} Pending
                </Text>
              </View>
            ) : null}
          </View>
          {joinRequestsQuery.isLoading ? (
            <ActivityIndicator color={colors.foregroundMuted} />
          ) : joinRequestsQuery.isError ? (
            <Text style={[COMMUNITY_WEB_TYPE.body, { color: colors.destructive }]}>{joinRequestsQuery.error?.message}</Text>
          ) : (joinRequestsQuery.data ?? []).length === 0 ? (
            <Text style={[COMMUNITY_WEB_TYPE.body, { color: colors.foregroundMuted }]}>No pending requests</Text>
          ) : (
            joinRequestsQuery.data?.map((request) => (
              <WebJoinRequestCard
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

      {isMember && activeTab === 'challenges' && isOwner ? (
        <View style={styles.challengeCtaRow}>
          <WebPillButton
            label="+ Team Challenge"
            onPress={() => router.push({ pathname: '/communities/[id]/challenges/new', params: { id: community.id } })}
          />
          <WebPillButton
            label="Challenge a Community"
            variant="outline"
            onPress={() => router.push({ pathname: '/communities/[id]/challenges/vs', params: { id: community.id } })}
          />
        </View>
      ) : null}

      {isMember && activeTab === 'members' ? (
        <Text style={[COMMUNITY_WEB_TYPE.label, styles.sectionLabel, { color: colors.foregroundMuted }]}>Members</Text>
      ) : null}
    </View>
  );

  if (isMember && activeTab === 'feed') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <WebCommunityTopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <FlatList
          data={memes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <WebCommunityFeedCard meme={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.5}
          onEndReached={() => feedQuery.hasNextPage && !feedQuery.isFetchingNextPage && feedQuery.fetchNextPage()}
          ListFooterComponent={feedQuery.isFetchingNextPage ? <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} /> : null}
          ListEmptyComponent={
            feedQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : feedQuery.isError ? (
              <Text style={[COMMUNITY_WEB_TYPE.body, styles.emptyText, { color: colors.destructive }]}>{feedQuery.error?.message}</Text>
            ) : (
              <Text style={[COMMUNITY_WEB_TYPE.body, styles.emptyText, { color: colors.foregroundMuted }]}>
                No posts in this community yet
              </Text>
            )
          }
        />
        <FloatingBottomNav active="communities" />
      </View>
    );
  }

  if (isMember && activeTab === 'leaderboard') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <WebCommunityTopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <ScrollView contentContainerStyle={styles.listContent}>
          {header}
          <View style={[styles.seamContainer, { backgroundColor: MASTER_DARK_SEAM.card, borderColor: MASTER_DARK_SEAM.border }]}>
            {leaderboardQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={MASTER_DARK_SEAM.inkMuted} />
            ) : leaderboardQuery.isError ? (
              <Text style={[COMMUNITY_WEB_TYPE.body, { color: MASTER_DARK_SEAM.error, padding: COMMUNITY_WEB_SPACING.lg }]}>
                {leaderboardQuery.error?.message}
              </Text>
            ) : leaderboardEntries.length === 0 ? (
              <Text style={[COMMUNITY_WEB_TYPE.body, { color: MASTER_DARK_SEAM.inkMuted, padding: COMMUNITY_WEB_SPACING.lg }]}>
                No scores yet in this community
              </Text>
            ) : (
              leaderboardEntries.map((entry) => (
                <IndividualLeaderboardRow key={entry.user.id} entry={entry} isViewer={entry.user.id === currentUser?.id} />
              ))
            )}
            {leaderboardQuery.hasNextPage && !leaderboardQuery.isFetchingNextPage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more"
                onPress={() => leaderboardQuery.fetchNextPage()}
                style={styles.loadMore}>
                <Text style={[COMMUNITY_WEB_TYPE.title, { color: MASTER_DARK_SEAM.primary }]}>Load more</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        <FloatingBottomNav active="communities" />
      </View>
    );
  }

  if (isMember && activeTab === 'challenges') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <WebCommunityTopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
        <ScrollView contentContainerStyle={styles.listContent}>
          {header}
          <View style={[styles.seamContainer, { backgroundColor: MASTER_DARK_SEAM.card, borderColor: MASTER_DARK_SEAM.border, padding: COMMUNITY_WEB_SPACING.lg }]}>
            {challengesQuery.isLoading ? (
              <ActivityIndicator color={MASTER_DARK_SEAM.inkMuted} />
            ) : challengesQuery.isError ? (
              <Text style={[COMMUNITY_WEB_TYPE.body, { color: MASTER_DARK_SEAM.error }]}>{challengesQuery.error?.message}</Text>
            ) : (challengesQuery.data ?? []).length === 0 ? (
              <Text style={[COMMUNITY_WEB_TYPE.body, { color: MASTER_DARK_SEAM.inkMuted }]}>No challenges yet</Text>
            ) : (
              challengesQuery.data?.map((challenge) => (
                <ChallengeRow
                  key={challenge.id}
                  challenge={challenge}
                  onPress={() =>
                    router.push({ pathname: '/communities/[id]/challenges/[challengeId]', params: { id: community.id, challengeId: challenge.id } })
                  }
                />
              ))
            )}
          </View>
        </ScrollView>
        <FloatingBottomNav active="communities" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <WebCommunityTopBar title={community.name} showBack rightActions={pendingRequestsBadge} />
      <ScrollView contentContainerStyle={styles.listContent}>
        {header}
        <View style={styles.membersGrid}>
          {membersQuery.isLoading ? (
            <ActivityIndicator color={colors.foregroundMuted} />
          ) : membersQuery.isError ? (
            <Text style={[COMMUNITY_WEB_TYPE.body, { color: colors.destructive }]}>{membersQuery.error?.message}</Text>
          ) : (
            membersQuery.data?.map((member) => <WebMemberCard key={member.id} membership={member} />)
          )}
        </View>
      </ScrollView>
      <FloatingBottomNav active="communities" />
    </View>
  );
}

export default function CommunityDetailScreen(props: CommunityDetailScreenProps) {
  return (
    <CommunityThemeProvider>
      <CommunityDetailScreenContent {...props} />
    </CommunityThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  spinner: {
    marginVertical: COMMUNITY_WEB_SPACING.xl,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: COMMUNITY_WEB_SPACING.xl,
    paddingHorizontal: COMMUNITY_WEB_SPACING.xl,
  },
  headerBlock: {
    padding: COMMUNITY_WEB_SPACING.xl,
    gap: COMMUNITY_WEB_SPACING.lg,
  },
  headerTop: {
    alignItems: 'center',
    gap: 4,
  },
  communityIcon: {
    width: 88,
    height: 88,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
  },
  communityIconFallback: {
    width: 88,
    height: 88,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityName: {
    marginTop: COMMUNITY_WEB_SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.sm,
    marginTop: 2,
  },
  metaPill: {
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 3,
  },
  description: {
    textAlign: 'center',
    marginTop: COMMUNITY_WEB_SPACING.sm,
    maxWidth: 440,
  },
  actionButtonWrap: {
    marginTop: COMMUNITY_WEB_SPACING.lg,
    minWidth: 200,
    alignItems: 'center',
  },
  ownerPill: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: COMMUNITY_WEB_SPACING.xl,
  },
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.md,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    padding: COMMUNITY_WEB_SPACING.lg,
  },
  challengeIcon: {
    height: 40,
    width: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    alignItems: 'flex-start',
  },
  postButtonWrap: {
    alignItems: 'flex-start',
  },
  joinRequestsBlock: {
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  joinRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMMUNITY_WEB_SPACING.sm,
  },
  pendingCountPill: {
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
    paddingVertical: 2,
  },
  challengeCtaRow: {
    flexDirection: 'row',
    gap: COMMUNITY_WEB_SPACING.md,
  },
  sectionLabel: {
    marginTop: -COMMUNITY_WEB_SPACING.sm,
  },
  requestsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    borderRadius: COMMUNITY_WEB_RADIUS.pill,
    paddingHorizontal: COMMUNITY_WEB_SPACING.md,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COMMUNITY_WEB_SPACING.md,
    paddingHorizontal: COMMUNITY_WEB_SPACING.xl,
  },
  seamContainer: {
    marginHorizontal: COMMUNITY_WEB_SPACING.xl,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: COMMUNITY_WEB_SPACING.lg,
  },
});
