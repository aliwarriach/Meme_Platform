import { PhotoEditSheet } from '@/components/PhotoEditSheet';
import { AVATAR_PRESETS } from '@/constants/avatarPresets';
import { useUpdateAvatarMutation } from '@/services/useAuth';

interface EditAvatarModalProps {
  visible: boolean;
  onClose: () => void;
  hasAvatar: boolean;
}

/** Instagram-style "edit profile photo" sheet: pick + crop a photo (square, same aspect
 * Instagram uses for a profile picture), pick one of a handful of built-in avatars, or remove
 * the current photo entirely. */
export function EditAvatarModal({ visible, onClose, hasAvatar }: EditAvatarModalProps) {
  const updateAvatar = useUpdateAvatarMutation();

  return (
    <PhotoEditSheet
      visible={visible}
      onClose={onClose}
      title="Profile Photo"
      aspect={[1, 1]}
      uploadContext="avatars"
      hasPhoto={hasAvatar}
      presets={AVATAR_PRESETS}
      onUploaded={(publicId) =>
        updateAvatar.mutate({ kind: 'public_id', avatar_public_id: publicId }, { onSuccess: onClose })
      }
      onPickPreset={(presetId) =>
        updateAvatar.mutate({ kind: 'preset', avatar_preset: presetId }, { onSuccess: onClose })
      }
      onRemove={() => updateAvatar.mutate({ kind: 'clear' }, { onSuccess: onClose })}
      isSaving={updateAvatar.isPending}
      saveError={updateAvatar.error?.message ?? null}
    />
  );
}
