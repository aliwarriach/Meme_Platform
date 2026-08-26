import { PhotoEditSheet } from '@/components/PhotoEditSheet';
import { AVATAR_PRESETS } from '@/constants/avatarPresets';
import { useUpdateCommunityIconMutation } from '@/services/useCommunities';

interface EditCommunityIconModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
  hasIcon: boolean;
}

/** Same picker/preset/remove flow as a user's own `EditAvatarModal`, scoped to a community's
 * profile picture — owner-only (the button that opens this is itself owner-gated). */
export function EditCommunityIconModal({ visible, onClose, communityId, hasIcon }: EditCommunityIconModalProps) {
  const updateIcon = useUpdateCommunityIconMutation(communityId);

  return (
    <PhotoEditSheet
      visible={visible}
      onClose={onClose}
      title="Community Photo"
      aspect={[1, 1]}
      uploadContext="communities"
      hasPhoto={hasIcon}
      presets={AVATAR_PRESETS}
      onUploaded={(publicId) =>
        updateIcon.mutate({ kind: 'public_id', icon_public_id: publicId }, { onSuccess: onClose })
      }
      onPickPreset={(presetId) =>
        updateIcon.mutate({ kind: 'preset', icon_preset: presetId }, { onSuccess: onClose })
      }
      onRemove={() => updateIcon.mutate({ kind: 'clear' }, { onSuccess: onClose })}
      isSaving={updateIcon.isPending}
      saveError={updateIcon.error?.message ?? null}
    />
  );
}
