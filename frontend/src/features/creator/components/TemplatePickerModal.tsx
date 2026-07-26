import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Chip from '@/components/Chip';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { TemplateGrid } from '@/features/creator/components/TemplateGrid';
import type { TemplateResponse } from '@/services/templates';
import { useMyCommunities } from '@/services/useCommunities';
import { useCommunityTemplates, useCreateTemplateMutation, useTemplates } from '@/services/useTemplates';

interface TemplatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: TemplateResponse) => void;
}

type Scope = { type: 'global' } | { type: 'community'; communityId: string; communityName: string };

function GlobalTemplates({ onSelect }: { onSelect: (template: TemplateResponse) => void }) {
  const query = useTemplates();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <TemplateGrid
      items={items}
      isLoading={query.isLoading}
      isFetchingNextPage={query.isFetchingNextPage}
      hasNextPage={!!query.hasNextPage}
      onEndReached={() => query.fetchNextPage()}
      onSelect={onSelect}
      emptyMessage="No templates yet — be the first to upload one"
    />
  );
}

function CommunityTemplates({
  communityId,
  onSelect,
}: {
  communityId: string;
  onSelect: (template: TemplateResponse) => void;
}) {
  const query = useCommunityTemplates(communityId);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <TemplateGrid
      items={items}
      isLoading={query.isLoading}
      isFetchingNextPage={query.isFetchingNextPage}
      hasNextPage={!!query.hasNextPage}
      onEndReached={() => query.fetchNextPage()}
      onSelect={onSelect}
      emptyMessage="No templates in this community yet — be the first to upload one"
    />
  );
}

export function TemplatePickerModal({ visible, onClose, onSelect }: TemplatePickerModalProps) {
  const myCommunitiesQuery = useMyCommunities();
  const createTemplate = useCreateTemplateMutation();

  const [scope, setScope] = useState<Scope>({ type: 'global' });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const myCommunities = myCommunitiesQuery.data ?? [];

  const onPickUploadImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError('Photo library access is required to upload a template.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setUploadError(null);
      setPickedImage(result.assets[0]);
    }
  };

  const onSubmitUpload = async () => {
    if (!newName.trim()) {
      setUploadError('Name your template.');
      return;
    }
    if (!pickedImage) {
      setUploadError('Choose an image first.');
      return;
    }
    try {
      await createTemplate.mutateAsync({
        imageUri: pickedImage.uri,
        imageName: pickedImage.fileName ?? 'template.jpg',
        imageType: pickedImage.mimeType ?? 'image/jpeg',
        name: newName.trim(),
        communityId: scope.type === 'community' ? scope.communityId : undefined,
      });
      setNewName('');
      setPickedImage(null);
      setUploadOpen(false);
      setUploadError(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload template.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="font-heading text-xl text-heading">Choose a Template</Text>
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={uploadOpen ? 'Cancel template upload' : 'Add a new template'}
              onPress={() => setUploadOpen((open) => !open)}
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-2xl text-primary-dim">{uploadOpen ? '×' : '+'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close template picker"
              onPress={onClose}
              className="min-h-[44px] items-center justify-center">
              <Text className="font-title text-heading">Done</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="mb-2 flex-row"
          style={{ flexGrow: 0 }}>
          <View className="flex-row gap-2">
            <Chip label="Global" selected={scope.type === 'global'} onPress={() => setScope({ type: 'global' })} />
            {myCommunities.map((community) => (
              <Chip
                key={community.id}
                label={community.name}
                selected={scope.type === 'community' && scope.communityId === community.id}
                onPress={() =>
                  setScope({ type: 'community', communityId: community.id, communityName: community.name })
                }
              />
            ))}
          </View>
        </ScrollView>

        {uploadOpen ? (
          <View className="border-b border-outline-variant/30 px-4 pb-4">
            <Text className="mb-2 font-body text-xs text-ink-muted">
              {scope.type === 'community'
                ? `Uploading to ${scope.communityName}'s private library`
                : 'Uploading to the global library'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick a template image"
              onPress={onPickUploadImage}
              className="mb-2 h-28 items-center justify-center overflow-hidden rounded-card border border-dashed border-outline">
              {pickedImage ? (
                <Image source={{ uri: pickedImage.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text className="font-body text-ink-muted">Tap to choose an image</Text>
              )}
            </Pressable>
            <TextField label="Template name" value={newName} onChangeText={setNewName} />
            {uploadError ? <Text className="mb-2 font-body text-sm text-error">{uploadError}</Text> : null}
            <PillButton
              label={createTemplate.isPending ? 'Uploading…' : 'Upload Template'}
              onPress={onSubmitUpload}
              loading={createTemplate.isPending}
            />
          </View>
        ) : null}

        {scope.type === 'global' ? (
          <GlobalTemplates onSelect={onSelect} />
        ) : (
          <CommunityTemplates communityId={scope.communityId} onSelect={onSelect} />
        )}
      </SafeAreaView>
    </Modal>
  );
}
