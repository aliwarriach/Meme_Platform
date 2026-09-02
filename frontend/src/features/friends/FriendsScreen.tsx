import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/constants/ThemeMode';

import { KeyboardAvoidingScreen } from '@/components/KeyboardAvoidingScreen';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import DuelProposeModal from '@/features/challenges/components/DuelProposeModal';
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
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const friendsQuery = useFriendsList();
  const requestsQuery = useIncomingFriendRequests();
  const sendMutation = useSendFriendRequestMutation();
  const acceptMutation = useAcceptFriendRequestMutation();
  const removeMutation = useRemoveFriendshipMutation();
  const [duelTarget, setDuelTarget] = useState<FriendResponse | null>(null);
  const [friendSearch, setFriendSearch] = useState('');

  const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);
  const filteredFriends = useMemo(() => {
    const needle = friendSearch.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter((f) => f.user.username.toLowerCase().includes(needle));
  }, [friends, friendSearch]);

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
      onDuel={setDuelTarget}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="Friends" showBack />

      <KeyboardAvoidingScreen>
      <FlatList
        data={filteredFriends}
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
              <ActivityIndicator className="my-4" color={c.inkMuted} />
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
            {!friendsQuery.isLoading && !friendsQuery.isError && friends.length > 0 ? (
              <View className="mb-2 flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2">
                <MaterialIcons name="search" size={18} color={c.inkMuted} />
                <TextInput
                  value={friendSearch}
                  onChangeText={setFriendSearch}
                  placeholder="Search your friends"
                  placeholderTextColor={c.outline}
                  accessibilityLabel="Search your friends"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 py-1 font-body text-base text-heading"
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          friendsQuery.isLoading ? (
            <ActivityIndicator className="my-4" color={c.inkMuted} />
          ) : friendsQuery.isError ? (
            <Text className="mx-4 font-body text-sm text-error">{friendsQuery.error.message}</Text>
          ) : friends.length === 0 ? (
            <Text className="mx-4 font-body text-sm text-ink-muted">No friends yet</Text>
          ) : (
            <Text className="mx-4 font-body text-sm text-ink-muted">
              No friends match &quot;{friendSearch}&quot;.
            </Text>
          )
        }
      />
      </KeyboardAvoidingScreen>

      {duelTarget ? (
        <DuelProposeModal
          visible
          onClose={() => setDuelTarget(null)}
          opponentId={duelTarget.user.id}
          opponentUsername={duelTarget.user.username}
        />
      ) : null}
    </SafeAreaView>
  );
}
