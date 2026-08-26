import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { BottomSheet } from '@/components/BottomSheet';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { JoinRequestRow } from '@/features/communities/components/JoinRequestRow';
import {
  useApproveJoinRequestMutation,
  useJoinRequests,
  useRejectJoinRequestMutation,
} from '@/services/useCommunities';

interface CommunityRequestsModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
}

/** Owner-only: everyone who has asked to join this community, self-initiated (`pending`) —
 * distinct from an owner/member-sent invite (`invited`), which the invitee accepts or declines
 * themself and never shows up here. Moved out of the community header (where it used to sit
 * inline, always rendered) into its own sheet off the Members tab's "Requests" button. */
export function CommunityRequestsModal({ visible, onClose, communityId }: CommunityRequestsModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const requestsQuery = useJoinRequests(communityId, visible);
  const approveRequest = useApproveJoinRequestMutation(communityId);
  const rejectRequest = useRejectJoinRequestMutation(communityId);
  const requests = requestsQuery.data ?? [];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="border-t border-outline-variant/30 bg-bg">
        <View className="flex-row items-center justify-between p-4 pb-3">
          <Text className="font-heading text-lg text-heading">Join Requests</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        {requestsQuery.isLoading ? (
          <ActivityIndicator className="py-6" color={c.inkMuted} />
        ) : requestsQuery.isError ? (
          <Text className="px-4 py-6 font-body text-sm text-error">{requestsQuery.error?.message}</Text>
        ) : requests.length === 0 ? (
          <Text className="px-4 py-6 font-body text-ink-muted">No pending requests</Text>
        ) : (
          <FlatList
            style={{ flexGrow: 0, flexShrink: 1 }}
            data={requests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <JoinRequestRow
                request={item}
                isPending={approveRequest.isPending || rejectRequest.isPending}
                onApprove={() => approveRequest.mutate(item.id)}
                onReject={() => rejectRequest.mutate(item.id)}
              />
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
}
