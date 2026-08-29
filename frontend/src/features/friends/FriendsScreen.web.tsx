import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebFriendRequestRow } from '@/components/web/WebFriendRequestRow';
import { WebFriendRow } from '@/components/web/WebFriendRow';
import WebFriendsTopBar from '@/components/web/WebFriendsTopBar';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import DuelProposeModal from '@/features/challenges/components/DuelProposeModal';
import { sendFriendRequestSchema, type SendFriendRequestFormValues } from '@/features/friends/schemas';
import type { FriendResponse } from '@/services/friends';
import {
  useAcceptFriendRequestMutation,
  useFriendsList,
  useIncomingFriendRequests,
  useRemoveFriendshipMutation,
  useSendFriendRequestMutation,
} from '@/services/useFriends';

/**
 * Web-only sibling of `features/friends/FriendsScreen.tsx` (native-resolved, byte-for-byte
 * untouched — Metro/Expo Router's platform-extension resolution prefers this file for every web
 * bundle, `app/friends.tsx` needs zero changes). Reuses the Vaporwave/Luminous glass design
 * system already shipped on the web feed (`constants/webFeedThemeVapor.ts`) — mode comes from the
 * single app-wide `ThemeModeProvider` (see `constants/ThemeMode.tsx`), so a mode chosen on
 * Feed is already active here, instantly, not just on next visit.
 *
 * `DesktopShell` (mounted app-wide in `app/_layout.tsx`) already centers this screen in the
 * standard-width content column — no width handling needed here.
 */
export default function FriendsScreen() {
  return (
      <FriendsScreenContent />
  );
}

function FriendsScreenContent() {
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);

  const friendsQuery = useFriendsList();
  const requestsQuery = useIncomingFriendRequests();
  const sendMutation = useSendFriendRequestMutation();
  const acceptMutation = useAcceptFriendRequestMutation();
  const removeMutation = useRemoveFriendshipMutation();
  const [duelTarget, setDuelTarget] = useState<FriendResponse | null>(null);
  const [friendSearch, setFriendSearch] = useState('');

  useEffect(() => {
    injectFeedWebFont();
  }, []);

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

  const requests = requestsQuery.data ?? [];
  const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);
  const filteredFriends = useMemo(() => {
    const needle = friendSearch.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter((f) => f.user.username.toLowerCase().includes(needle));
  }, [friends, friendSearch]);

  const listHeader = (
    <View style={styles.section}>
      <Text style={[type.label, styles.sectionLabel]}>Add a friend</Text>
      <View style={styles.addRow}>
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Username"
              placeholderTextColor={colors.foregroundMuted}
              accessibilityLabel="Username"
              style={[
                type.body,
                styles.input,
                { borderColor: errors.username ? colors.error : colors.border },
              ]}
            />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send friend request"
          onPress={onSubmit}
          disabled={sendMutation.isPending}
          style={({ hovered }) => [
            styles.sendButton,
            hovered && !sendMutation.isPending && styles.sendButtonHovered,
            sendMutation.isPending && styles.disabled,
          ]}>
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={[type.title, styles.sendLabel]}>Send</Text>
          )}
        </Pressable>
      </View>
      {errors.username ? <Text style={[type.meta, styles.errorText]}>{errors.username.message}</Text> : null}
      {sendMutation.isError ? <Text style={[type.meta, styles.errorText]}>{sendMutation.error.message}</Text> : null}

      <Text style={[type.label, styles.sectionLabel, styles.sectionLabelSpaced]}>Friend requests</Text>
      {requestsQuery.isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
      ) : requestsQuery.isError ? (
        <Text style={[type.body, styles.errorText]}>{requestsQuery.error.message}</Text>
      ) : requests.length > 0 ? (
        requests.map((request) => (
          <WebFriendRequestRow
            key={request.id}
            request={request}
            onAccept={(friendshipId) => acceptMutation.mutate(friendshipId)}
            isAccepting={acceptMutation.isPending && acceptMutation.variables === request.id}
          />
        ))
      ) : (
        <Text style={[type.body, styles.mutedText]}>No pending requests</Text>
      )}

      <Text style={[type.label, styles.sectionLabel, styles.sectionLabelSpaced]}>Your friends</Text>
      {friends.length > 0 ? (
        <View style={styles.friendSearchRow}>
          <MaterialIcons name="search" size={18} color={colors.foregroundMuted} />
          <TextInput
            value={friendSearch}
            onChangeText={setFriendSearch}
            placeholder="Search your friends"
            placeholderTextColor={colors.foregroundMuted}
            accessibilityLabel="Search your friends"
            style={[type.body, styles.friendSearchInput]}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gradientMid }]} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <WebFriendsTopBar title="Friends" />

        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.friendship_id}
          renderItem={({ item }) => (
            <WebFriendRow
              friend={item}
              onRemove={(friendshipId) => removeMutation.mutate(friendshipId)}
              isRemoving={removeMutation.isPending && removeMutation.variables === item.friendship_id}
              onDuel={setDuelTarget}
            />
          )}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            friendsQuery.isLoading ? (
              <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
            ) : friendsQuery.isError ? (
              <Text style={[type.body, styles.errorText, styles.listEmptyPadding]}>{friendsQuery.error.message}</Text>
            ) : friends.length === 0 ? (
              <Text style={[type.body, styles.mutedText, styles.listEmptyPadding]}>No friends yet</Text>
            ) : (
              <Text style={[type.body, styles.mutedText, styles.listEmptyPadding]}>
                No friends match &quot;{friendSearch}&quot;.
              </Text>
            )
          }
        />
      </SafeAreaView>

      {duelTarget ? (
        <DuelProposeModal
          visible
          onClose={() => setDuelTarget(null)}
          opponentId={duelTarget.user.id}
          opponentUsername={duelTarget.user.username}
        />
      ) : null}
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    safe: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing.xxl,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sectionLabel: {
      color: colors.foregroundMuted,
      marginBottom: spacing.sm,
    },
    sectionLabelSpaced: {
      marginTop: spacing.lg,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      color: colors.foreground,
      backgroundColor: colors.surfaceGlass,
    },
    friendSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      borderColor: colors.border,
      backgroundColor: colors.surfaceGlass,
    },
    friendSearchInput: {
      flex: 1,
      color: colors.foreground,
    },
    sendButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.indigoPrimary,
    },
    sendButtonHovered: {
      opacity: 0.9,
    },
    sendLabel: {
      color: colors.onAccent,
    },
    disabled: {
      opacity: 0.5,
    },
    errorText: {
      color: colors.error,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    mutedText: {
      color: colors.foregroundMuted,
      marginBottom: spacing.sm,
    },
    spinner: {
      marginVertical: spacing.lg,
    },
    listEmptyPadding: {
      paddingHorizontal: spacing.lg,
    },
  });
