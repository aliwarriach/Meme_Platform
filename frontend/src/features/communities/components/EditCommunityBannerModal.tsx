import { PhotoEditSheet } from '@/components/PhotoEditSheet';
import { useUpdateCommunityBannerMutation } from '@/services/useCommunities';

interface EditCommunityBannerModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
  hasBanner: boolean;
}

/** Cover-photo equivalent of `EditCommunityIconModal` — upload/remove only, no preset system
 * (a wide cover photo isn't a "pick one of five built-ins" surface the way a small profile
 * picture is). 16:9, matching Facebook mobile's cover-photo aspect ratio. */
export function EditCommunityBannerModal({ visible, onClose, communityId, hasBanner }: EditCommunityBannerModalProps) {
  const updateBanner = useUpdateCommunityBannerMutation(communityId);

  return (
    <PhotoEditSheet
      visible={visible}
      onClose={onClose}
      title="Cover Photo"
      aspect={[16, 9]}
      uploadContext="communities"
      hasPhoto={hasBanner}
      onUploaded={(publicId) =>
        updateBanner.mutate({ kind: 'public_id', banner_public_id: publicId }, { onSuccess: onClose })
      }
      onRemove={() => updateBanner.mutate({ kind: 'clear' }, { onSuccess: onClose })}
      isSaving={updateBanner.isPending}
      saveError={updateBanner.error?.message ?? null}
    />
  );
}
