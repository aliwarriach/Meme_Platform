import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import WebAvatar from '@/components/web/WebAvatar';
import WebModalFrame from '@/components/web/WebModalFrame';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { FriendResponse } from '@/services/friends';
import { useFriendsList } from '@/services/useFriends';
import { useOpenConversationMutation } from '@/services/useMessaging';

interface WebNewChatModalProps {
  visible: boolean;
  onClose: () => void;
}

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Web-scoped sibling of `features/messaging/NewChatModal.tsx` (native-resolved, untouched — that
 * file already had a `Platform.OS==='web'` width branch predating this migration, which is now
 * unreachable dead code on web since this file wins Metro's platform-extension resolution; not
 * removed from the native file, out of scope). Unlike `WebCompetitionEntryModal`'s reused-native-
 * body seam, this modal's content (a short friend picker) is simple enough to build fully themed
 * rather than reusing native's NativeWind-classed `FlatList` rows.
 *
 * Same get-or-create flow as native: picking a friend opens/reuses the thread and navigates to
 * `/inbox/[conversationId]`, which now renders `ThreadScreen.web.tsx`.
 */
export default function WebNewChatModal({ visible, onClose }: WebNewChatModalProps) {
  const router = useRouter();
  const { colors, type, radius, spacing } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const { data: friends, isLoading } = useFriendsList();
  const openConversation = useOpenConversationMutation();

  const onPick = (userId: string) => {
    openConversation.mutate(userId, {
      onSuccess: (conversation) => {
        onClose();
        router.push({ pathname: '/inbox/[conversationId]', params: { conversationId: conversation.id } });
      },
    });
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      <WebModalFrame>
        <View style={[styles.root, { backgroundColor: colors.gradientBottom }]}>
          <View style={styles.header}>
            <Text style={[type.h2, styles.headerTitle]}>New Chat</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ hovered, focused }: WebPressableState) => [
                styles.closeButton,
                hovered && styles.closeButtonHovered,
                focused && { outlineColor: colors.indigoSecondary, outlineWidth: 2, outlineOffset: 1 },
              ]}>
              <MaterialIcons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.foregroundMuted} />
          ) : !friends || friends.length === 0 ? (
            <Text style={[type.body, styles.emptyText]}>
              Add a friend first — you can only message accepted friends.
            </Text>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item: FriendResponse) => item.friendship_id}
              renderItem={({ item }: { item: FriendResponse }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${item.user.username}`}
                  onPress={() => onPick(item.user.id)}
                  disabled={openConversation.isPending}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.friendRow,
                    hovered && !openConversation.isPending && styles.friendRowHovered,
                    openConversation.isPending && styles.disabled,
                    focused && { outlineColor: colors.indigoSecondary, outlineWidth: 2, outlineOffset: -2 },
                  ]}>
                  <WebAvatar username={item.user.username} size={36} />
                  <Text style={[type.body, styles.friendName]}>{item.user.username}</Text>
                </Pressable>
              )}
            />
          )}

          {openConversation.isError ? (
            <Text style={[type.meta, styles.errorText]}>{openConversation.error.message}</Text>
          ) : null}
        </View>
      </WebModalFrame>
    </Modal>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      color: colors.foreground,
    },
    closeButton: {
      height: 40,
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
    },
    closeButtonHovered: {
      backgroundColor: colors.surfaceHover,
    },
    spinner: {
      marginVertical: spacing.xxl,
    },
    emptyText: {
      color: colors.foregroundMuted,
      padding: spacing.lg,
    },
    friendRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    friendRowHovered: {
      backgroundColor: colors.surfaceHover,
    },
    friendName: {
      color: colors.foreground,
    },
    disabled: {
      opacity: 0.5,
    },
    errorText: {
      color: colors.error,
      padding: spacing.md,
    },
  });
