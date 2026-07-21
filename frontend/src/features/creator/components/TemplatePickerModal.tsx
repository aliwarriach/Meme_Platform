import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">
            Choose a template
          </Text>
          <View className="flex-row">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={uploadOpen ? 'Cancel template upload' : 'Add a new template'}
              onPress={() => setUploadOpen((open) => !open)}
              className="mr-2 min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-2xl text-orange-500">{uploadOpen ? '×' : '+'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close template picker"
              onPress={onClose}
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-2xl text-neutral-900 dark:text-white">Done</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="mb-2 flex-row"
          style={{ flexGrow: 0 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show global templates"
            onPress={() => setScope({ type: 'global' })}
            className={`mr-2 min-h-[36px] items-center justify-center rounded-xl px-4 ${
              scope.type === 'global' ? 'bg-orange-500' : 'bg-neutral-100 dark:bg-neutral-900'
            }`}>
            <Text
              className={
                scope.type === 'global' ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
              }>
              Global
            </Text>
          </Pressable>
          {myCommunities.map((community) => {
            const selected = scope.type === 'community' && scope.communityId === community.id;
            return (
              <Pressable
                key={community.id}
                accessibilityRole="button"
                accessibilityLabel={`Show ${community.name} templates`}
                onPress={() =>
                  setScope({ type: 'community', communityId: community.id, communityName: community.name })
                }
                className={`mr-2 min-h-[36px] items-center justify-center rounded-xl px-4 ${
                  selected ? 'bg-orange-500' : 'bg-neutral-100 dark:bg-neutral-900'
                }`}>
                <Text className={selected ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'}>
                  {community.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {uploadOpen ? (
          <View className="border-b border-neutral-100 px-4 pb-4 dark:border-neutral-800">
            <Text className="mb-2 text-xs text-neutral-400">
              {scope.type === 'community'
                ? `Uploading to ${scope.communityName}'s private library`
                : 'Uploading to the global library'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick a template image"
              onPress={onPickUploadImage}
              className="mb-2 h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
              {pickedImage ? (
                <Image
                  source={{ uri: pickedImage.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Text className="text-neutral-400">Tap to choose an image</Text>
              )}
            </Pressable>
            <TextField label="Template name" value={newName} onChangeText={setNewName} />
            {uploadError ? <Text className="mb-2 text-sm text-red-500">{uploadError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload template"
              onPress={onSubmitUpload}
              disabled={createTemplate.isPending}
              className="items-center rounded-xl bg-orange-500 py-3 disabled:opacity-50">
              <Text className="text-base font-bold text-white">
                {createTemplate.isPending ? 'Uploading…' : 'Upload template'}
              </Text>
            </Pressable>
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
