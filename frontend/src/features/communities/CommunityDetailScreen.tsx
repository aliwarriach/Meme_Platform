import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { JoinRequestRow } from '@/features/communities/components/JoinRequestRow';
import { MemberRow } from '@/features/communities/components/MemberRow';
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

interface CommunityDetailScreenProps {
  communityId: string;
}

export default function CommunityDetailScreen({ communityId }: CommunityDetailScreenProps) {
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const communityQuery = useCommunity(communityId);
  const membersQuery = useMembers(communityId);
  const joinCommunity = useJoinCommunityMutation(communityId);
  const leaveCommunity = useLeaveCommunityMutation(communityId);

  const community = communityQuery.data;
  const isOwner = !!community && !!currentUser && community.owner.id === currentUser.id;

  const joinRequestsQuery = useJoinRequests(communityId, isOwner);
  const approveRequest = useApproveJoinRequestMutation(communityId);
  const rejectRequest = useRejectJoinRequestMutation(communityId);

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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView className="flex-1 px-6 py-4">
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

        <View>
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
