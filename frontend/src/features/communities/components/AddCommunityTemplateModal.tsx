import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { BottomSheet } from '@/components/BottomSheet';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { useCreateTemplateMutation } from '@/services/useTemplates';

interface AddCommunityTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  communityId: string;
}

/** Minimal "add a template" sheet scoped to a single community — the community's own Templates
 * tab already knows which community it's adding to, so unlike `TemplatePickerModal` (global +
 * per-community scope switcher, used from inside the creator) there's no scope to pick. */
export function AddCommunityTemplateModal({ visible, onClose, communityId }: AddCommunityTemplateModalProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const createTemplate = useCreateTemplateMutation();
  const [name, setName] = useState('');
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setPickedImage(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onPickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is required to add a template.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setError(null);
      setPickedImage(result.assets[0]);
    }
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Name your template.');
      return;
    }
    if (!pickedImage) {
      setError('Choose an image first.');
      return;
    }
    try {
      await createTemplate.mutateAsync({
        imageUri: pickedImage.uri,
        imageName: pickedImage.fileName ?? 'template.jpg',
        imageType: pickedImage.mimeType ?? 'image/jpeg',
        name: name.trim(),
        communityId,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that template.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View className="border-t border-outline-variant/30 bg-bg p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-heading text-lg text-heading">Add Template</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a template image"
          onPress={onPickImage}
          className="mb-3 h-32 items-center justify-center overflow-hidden rounded-card border border-dashed border-outline">
          {pickedImage ? (
            <Image source={{ uri: pickedImage.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Text className="font-body text-ink-muted">Tap to choose an image</Text>
          )}
        </Pressable>

        <TextField label="Template name" value={name} onChangeText={setName} />
        {error ? <Text className="mb-2 mt-1 font-body text-sm text-error">{error}</Text> : null}

        <View className="mt-2">
          <PillButton
            label={createTemplate.isPending ? 'Adding…' : 'Add Template'}
            onPress={onSubmit}
            loading={createTemplate.isPending}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
