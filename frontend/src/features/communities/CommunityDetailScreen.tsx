import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { JoinRequestRow } from '@/features/communities/components/JoinRequestRow';
import { MemberRow } from '@/features/communities/components/MemberRow';
import { MemeFeedList } from '@/features/feed/components/MemeFeedList';
import { IndividualLeaderboardRow } from '@/features/leaderboards/components/IndividualLeaderboardRow';
import type { RootState } from '@/store/store';
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
import type { MemeResponse } from '@/services/memes';

interface CommunityDetailScreenProps {
  communityId: string;
}

type Tab = 'feed' | 'members' | 'leaderboard';

export default function CommunityDetailScreen({ communityId }: CommunityDetailScreenProps) {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState<Tab>('feed');

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

  const feedQuery = useCommunityFeed(communityId, isMember && activeTab === 'feed');
  const memes: MemeResponse[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const leaderboardQuery = useInternalCommunityLeaderboard(
    communityId,
    isMember && activeTab === 'leaderboard'
  );
  const leaderboardEntries = leaderboardQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (communityQuery.isLoading || !community) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        {communityQuery.isError ? (
          <Text className="px-6 text-center text-sm text-red-500">
            {communityQuery.error?.message}
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  const renderActionButton = () => {
    if (isOwner) {
      return (
        <View className="rounded-xl border border-neutral-300 py-3 dark:border-neutral-700">
          <Text className="text-center font-bold text-neutral-900 dark:text-white">
            You own this community
          </Text>
        </View>
      );
    }

    if (community.viewer_membership_status === 'active') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave community"
          onPress={() => leaveCommunity.mutate()}
          disabled={leaveCommunity.isPending}
          className="items-center rounded-xl border border-red-500 py-3 disabled:opacity-50">
          <Text className="font-bold text-red-500">
            {leaveCommunity.isPending ? 'Leaving…' : 'Leave community'}
          </Text>
        </Pressable>
      );
    }

    if (community.viewer_membership_status === 'pending') {
      return (
        <View className="items-center rounded-xl bg-neutral-100 py-3 dark:bg-neutral-900">
          <Text className="font-bold text-neutral-500 dark:text-neutral-400">
            Request pending owner approval
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={community.privacy === 'open' ? 'Join community' : 'Request to join'}
        onPress={() => joinCommunity.mutate()}
        disabled={joinCommunity.isPending}
        className="items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50">
        <Text className="font-bold text-white">
          {joinCommunity.isPending
            ? 'Sending…'
            : community.privacy === 'open'
              ? 'Join community'
              : 'Request to join'}
        </Text>
      </Pressable>
    );
  };

  const header = (
    <View className="px-6 pt-4">
      <View className="mb-4 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
        </Pressable>
      </View>

      <View className="mb-4 items-center">
        {community.icon_url ? (
          <Image
            source={{ uri: community.icon_url }}
            style={{ width: 80, height: 80, borderRadius: 20 }}
            contentFit="cover"
          />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-orange-500">
            <Text className="text-2xl font-extrabold text-white">
              {community.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <Text className="mt-3 text-xl font-extrabold text-neutral-900 dark:text-white">
          {community.name}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {community.member_count} member{community.member_count === 1 ? '' : 's'} ·{' '}
          {community.privacy === 'open' ? 'Open' : 'Invite only'}
        </Text>
        {community.description ? (
          <Text className="mt-2 text-center text-neutral-700 dark:text-neutral-300">
            {community.description}
          </Text>
        ) : null}
      </View>

      <View className="mb-6">{renderActionButton()}</View>

      {isOwner ? (
        <View className="mb-6">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Join requests
          </Text>
          {joinRequestsQuery.isLoading ? (
            <ActivityIndicator />
          ) : joinRequestsQuery.isError ? (
            <Text className="text-sm text-red-500">{joinRequestsQuery.error?.message}</Text>
          ) : (joinRequestsQuery.data ?? []).length === 0 ? (
            <Text className="text-sm text-neutral-400">No pending requests</Text>
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
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show community feed"
              onPress={() => setActiveTab('feed')}
              className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
                activeTab === 'feed'
                  ? 'border-orange-500 bg-orange-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text className={activeTab === 'feed' ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                Feed
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show members"
              onPress={() => setActiveTab('members')}
              className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
                activeTab === 'members'
                  ? 'border-orange-500 bg-orange-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text
                className={
                  activeTab === 'members' ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
                }>
                Members
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show community leaderboard"
              onPress={() => setActiveTab('leaderboard')}
              className={`min-h-[44px] items-center justify-center rounded-xl border px-4 ${
                activeTab === 'leaderboard'
                  ? 'border-orange-500 bg-orange-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}>
              <Text
                className={
                  activeTab === 'leaderboard'
                    ? 'font-bold text-white'
                    : 'text-neutral-900 dark:text-white'
                }>
                Leaderboard
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Post to ${community.name}`}
            onPress={() =>
              router.push({
                pathname: '/new-post',
                params: { communityId: community.id, communityName: community.name },
              })
            }
            className="min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4">
            <Text className="text-sm font-bold text-white">+ Post</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (isMember && activeTab === 'feed') {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
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
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
        <FlatList
          data={leaderboardEntries}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item }) => (
            <IndividualLeaderboardRow entry={item} isViewer={item.user.id === currentUser?.id} />
          )}
          ListHeaderComponent={header}
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
            leaderboardQuery.isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
          ListEmptyComponent={
            leaderboardQuery.isLoading ? (
              <ActivityIndicator className="my-8" />
            ) : leaderboardQuery.isError ? (
              <Text className="mx-6 text-sm text-red-500">{leaderboardQuery.error?.message}</Text>
            ) : (
              <Text className="mx-6 mt-8 text-center text-sm text-neutral-400">
                No scores yet in this community
              </Text>
            )
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView className="flex-1">
        {header}
        <View className="px-6 pb-6">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Members
          </Text>
          {membersQuery.isLoading ? (
            <ActivityIndicator />
          ) : membersQuery.isError ? (
            <Text className="text-sm text-neutral-400">{membersQuery.error?.message}</Text>
          ) : (
            membersQuery.data?.map((member) => <MemberRow key={member.id} membership={member} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
