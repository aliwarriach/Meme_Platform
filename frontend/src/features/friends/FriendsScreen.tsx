import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/TextField';
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
  const router = useRouter();

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
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
        </Pressable>
        <Text className="ml-1 text-xl font-extrabold text-neutral-900 dark:text-white">
          Friends
        </Text>
      </View>

      <FlatList
        data={friendsQuery.data ?? []}
        keyExtractor={(item) => item.friendship_id}
        renderItem={renderFriend}
        ListHeaderComponent={
          <View className="px-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Add a friend
            </Text>
            <View className="mb-2 flex-row items-start">
              <View className="mr-2 flex-1">
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send friend request"
                onPress={onSubmit}
                disabled={sendMutation.isPending}
                className="mt-6 min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 disabled:opacity-50">
                <Text className="text-sm font-bold text-white">
                  {sendMutation.isPending ? 'Sending…' : 'Send'}
                </Text>
              </Pressable>
            </View>
            {sendMutation.isError ? (
              <Text className="mb-4 text-sm text-red-500">{sendMutation.error.message}</Text>
            ) : null}

            <Text className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Friend requests
            </Text>
            {requestsQuery.isLoading ? (
              <ActivityIndicator className="my-4" />
            ) : requestsQuery.isError ? (
              <Text className="mb-4 text-sm text-red-500">{requestsQuery.error.message}</Text>
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
              <Text className="mb-4 text-sm text-neutral-400">No pending requests</Text>
            )}

            <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Your friends
            </Text>
          </View>
        }
        ListEmptyComponent={
          friendsQuery.isLoading ? (
            <ActivityIndicator className="my-4" />
          ) : friendsQuery.isError ? (
            <Text className="mx-4 text-sm text-red-500">{friendsQuery.error.message}</Text>
          ) : (
            <Text className="mx-4 text-sm text-neutral-400">No friends yet</Text>
          )
        }
      />
    </SafeAreaView>
  );
}
