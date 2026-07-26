import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { FriendRequestRow } from '@/features/friends/components/FriendRequestRow';
import { FriendRow } from '@/features/friends/components/FriendRow';
import {
  sendFriendRequestSchema,
  type SendFriendRequestFormValues,
} from '@/features/friends/schemas';
import type { FriendResponse } from '@/services/friends';
import {
  useAcceptFriendRequestMutation,
  useFriendsList,
  useIncomingFriendRequests,
  useRemoveFriendshipMutation,
  useSendFriendRequestMutation,
} from '@/services/useFriends';

export default function FriendsScreen() {
  const friendsQuery = useFriendsList();
  const requestsQuery = useIncomingFriendRequests();
  const sendMutation = useSendFriendRequestMutation();
  const acceptMutation = useAcceptFriendRequestMutation();
  const removeMutation = useRemoveFriendshipMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendFriendRequestFormValues>({
    resolver: zodResolver(sendFriendRequestSchema),
    defaultValues: { username: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sendMutation.mutateAsync(values);
      reset({ username: '' });
    } catch {
      // surfaced inline via sendMutation.isError below
    }
  });

  const renderFriend = ({ item }: { item: FriendResponse }) => (
    <FriendRow
      friend={item}
      onRemove={(friendshipId) => removeMutation.mutate(friendshipId)}
      isRemoving={removeMutation.isPending && removeMutation.variables === item.friendship_id}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Friends" showBack />

      <FlatList
        data={friendsQuery.data ?? []}
        keyExtractor={(item) => item.friendship_id}
        renderItem={renderFriend}
        ListHeaderComponent={
          <View className="px-4 pt-4">
            <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Add a friend
            </Text>
            <View className="mb-2 flex-row items-start gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="username"
                  render={({ field }) => (
                    <TextField
                      label="Username"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={errors.username?.message}
                    />
                  )}
                />
              </View>
              <PillButton
                label={sendMutation.isPending ? 'Sending…' : 'Send'}
                onPress={onSubmit}
                loading={sendMutation.isPending}
                className="mt-1"
              />
            </View>
            {sendMutation.isError ? (
              <Text className="mb-4 font-body text-sm text-error">{sendMutation.error.message}</Text>
            ) : null}

            <Text className="mb-2 mt-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Friend requests
            </Text>
            {requestsQuery.isLoading ? (
              <ActivityIndicator className="my-4" color="#e3bdc5" />
            ) : requestsQuery.isError ? (
              <Text className="mb-4 font-body text-sm text-error">{requestsQuery.error.message}</Text>
            ) : requestsQuery.data && requestsQuery.data.length > 0 ? (
              requestsQuery.data.map((request) => (
                <FriendRequestRow
                  key={request.id}
                  request={request}
                  onAccept={(friendshipId) => acceptMutation.mutate(friendshipId)}
                  isAccepting={acceptMutation.isPending && acceptMutation.variables === request.id}
                />
              ))
            ) : (
              <Text className="mb-4 font-body text-sm text-ink-muted">No pending requests</Text>
            )}

            <Text className="mb-2 mt-4 font-label text-xs uppercase tracking-wide text-ink-muted">
              Your friends
            </Text>
          </View>
        }
        ListEmptyComponent={
          friendsQuery.isLoading ? (
            <ActivityIndicator className="my-4" color="#e3bdc5" />
          ) : friendsQuery.isError ? (
            <Text className="mx-4 font-body text-sm text-error">{friendsQuery.error.message}</Text>
          ) : (
            <Text className="mx-4 font-body text-sm text-ink-muted">No friends yet</Text>
          )
        }
      />
    </SafeAreaView>
  );
}
