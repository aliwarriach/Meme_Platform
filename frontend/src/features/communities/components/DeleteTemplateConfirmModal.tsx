import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import PillButton from '@/components/PillButton';
import type { TemplateResponse } from '@/services/templates';
import { useDeleteCommunityTemplateMutation } from '@/services/useTemplates';

interface DeleteTemplateConfirmModalProps {
  communityId: string;
  template: TemplateResponse | null;
  onClose: () => void;
}

/** Owner-only — confirms removing a template from the community's private library,
 * regardless of who uploaded it (moderation over the shared library, not authorship). */
export function DeleteTemplateConfirmModal({ communityId, template, onClose }: DeleteTemplateConfirmModalProps) {
  const deleteTemplate = useDeleteCommunityTemplateMutation(communityId);

  const handleClose = () => {
    if (deleteTemplate.isPending) return;
    deleteTemplate.reset();
    onClose();
  };

  const onConfirm = async () => {
    if (!template) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      handleClose();
    } catch {
      // surfaced inline via deleteTemplate.isError below
    }
  };

  return (
    <BottomSheet visible={!!template} onClose={handleClose} maxHeightPercent={40}>
      <View className="border-t border-outline-variant/30 bg-bg p-4">
        <Text className="mb-3 font-heading text-lg text-heading">Delete this template?</Text>
        {template ? (
          <View className="mb-3 flex-row items-center gap-3">
            <Image
              source={{ uri: template.image_url }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              contentFit="cover"
            />
            <Text className="flex-1 font-body text-sm text-ink">{template.name}</Text>
          </View>
        ) : null}
        <Text className="mb-4 font-body text-sm text-ink-muted">
          It won&apos;t be usable for new memes anymore. This can&apos;t be undone.
        </Text>
        {deleteTemplate.isError ? (
          <Text className="mb-3 font-body text-sm text-error">{deleteTemplate.error.message}</Text>
        ) : null}
        <PillButton
          label={deleteTemplate.isPending ? 'Deleting…' : 'Delete'}
          onPress={onConfirm}
          loading={deleteTemplate.isPending}
          className="mb-2"
        />
        <PillButton label="Cancel" variant="outline" onPress={handleClose} disabled={deleteTemplate.isPending} />
      </View>
    </BottomSheet>
  );
}
