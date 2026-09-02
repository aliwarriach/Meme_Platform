import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import Avatar from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { PublicUserResponse } from '@/services/auth';
import { useFriendsList } from '@/services/useFriends';
import { useInviteToCommunityMutation } from '@/services/useCommunities';
import { useSearchUsers } from '@/services/useUsers';

interface AddMembersModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
}

/** Search-and-invite sheet for a community's Members tab — friends and non-friends alike,
 * every invite is a request the target has to accept, never an instant add (server enforces
 * this: `POST /communities/{id}/invites` always creates an `invited` row, never `active`).
 * Shows the viewer's friends by default; typing a search switches to matching any user by
 * username (friends included, since search isn't friends-scoped). */
export function AddMembersModal({ visible, onClose, communityId }: AddMembersModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const friendsQuery = useFriendsList();
  const searchQuery = useSearchUsers(query, query.trim().length > 0);
  const invite = useInviteToCommunityMutation(communityId);

  const isSearching = query.trim().length > 0;
  const people: PublicUserResponse[] = isSearching
    ? (searchQuery.data ?? [])
    : (friendsQuery.data ?? []).map((f) => f.user);
  const isLoading = isSearching ? searchQuery.isLoading : friendsQuery.isLoading;

  const onInvite = (user: PublicUserResponse) => {
    invite.mutate(user.username, {
      onSuccess: () => setInvitedIds((current) => [...current, user.id]),
    });
  };

  const handleClose = () => {
    setQuery('');
    setInvitedIds([]);
    onClose();
  };

  const openProfile = (userId: string) => {
    handleClose();
    router.push({ pathname: '/users/[id]', params: { id: userId } });
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View className="border-t border-outline-variant/30 bg-bg">
        <View className="flex-row items-center justify-between p-4 pb-3">
          <Text className="font-heading text-lg text-heading">Add Members</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-full border border-outline-variant bg-surface-high/60 px-4 py-2">
          <MaterialIcons name="search" size={18} color={c.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username"
            placeholderTextColor={c.outline}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-1 font-body text-base text-heading"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator className="py-6" color={c.inkMuted} />
        ) : people.length === 0 ? (
          <Text className="px-4 py-6 font-body text-ink-muted">
            {isSearching ? `No users match "${query}".` : 'No friends yet — search for anyone by username.'}
          </Text>
        ) : (
          <FlatList
            style={{ flexGrow: 0, flexShrink: 1 }}
            data={people}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const isInvited = invitedIds.includes(item.id);
              return (
                <View className="min-h-[44px] flex-row items-center justify-between rounded-card px-3 py-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.username}'s profile`}
                    onPress={() => openProfile(item.id)}
                    className="flex-1 flex-row items-center gap-3">
                    <Avatar username={item.username} avatarUrl={item.avatar_url} avatarPreset={item.avatar_preset} size="md" />
                    <Text className="font-body text-heading">{item.username}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isInvited ? `Already invited ${item.username}` : `Invite ${item.username}`}
                    onPress={() => onInvite(item)}
                    disabled={isInvited || invite.isPending}
                    className="min-h-[36px] items-center justify-center rounded-full bg-primary-container px-4 disabled:opacity-50">
                    <Text className="font-title text-xs text-white">{isInvited ? 'Sent' : 'Invite'}</Text>
                  </Pressable>
                </View>
              );
            }}
          />
        )}

        {invite.isError ? (
          <Text className="px-4 pb-3 font-body text-xs text-error">{invite.error.message}</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
