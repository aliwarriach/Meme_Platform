import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useThemeMode } from '@/constants/ThemeMode';

import { BottomSheet } from '@/components/BottomSheet';
import type { AvatarPreset } from '@/constants/avatarPresets';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { UploadContext } from '@/services/media';
import { uploadImageDirect } from '@/services/media';

interface PhotoEditSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Picker crop aspect ratio — `[1, 1]` for a profile picture, `[16, 9]` for a cover photo. */
  aspect: [number, number];
  uploadContext: UploadContext;
  hasPhoto: boolean;
  /** Omit to hide the "Choose an Avatar" preset section entirely — a cover photo has no
   * built-in-avatar equivalent, only upload/remove. */
  presets?: AvatarPreset[];
  onUploaded: (publicId: string) => void;
  onPickPreset?: (presetId: string) => void;
  onRemove: () => void;
  /** True while the caller's own mutation is in flight — disables every action so a second
   * tap can't fire a second mutation while the first hasn't resolved. */
  isSaving: boolean;
  saveError: string | null;
}

/** Shared "edit a photo" sheet chrome — pick+crop from the library (uploaded straight to
 * Cloudinary via the existing direct-upload flow), optionally pick a built-in avatar preset,
 * or remove the current photo. Used for the signed-in user's own avatar and, identically, for a
 * community's icon/banner — the only real differences between those call sites are the crop
 * aspect, the upload folder, whether presets apply, and what mutation actually saves the result,
 * all passed in rather than duplicated. */
export function PhotoEditSheet({
  visible,
  onClose,
  title,
  aspect,
  uploadContext,
  hasPhoto,
  presets,
  onUploaded,
  onPickPreset,
  onRemove,
  isSaving,
  saveError,
}: PhotoEditSheetProps) {
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  const [isUploading, setIsUploading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Photo library access is required to set a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setPickerError(null);
    setIsUploading(true);
    try {
      const asset = result.assets[0];
      const publicId = await uploadImageDirect(
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
        uploadContext
      );
      onUploaded(publicId);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : 'Could not upload that photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const busy = isUploading || isSaving;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="border-t border-outline-variant/30 bg-bg p-4 pb-8">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-heading text-lg text-heading">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <MaterialIcons name="close" size={22} color={c.inkMuted} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo from your library"
          onPress={onPickPhoto}
          disabled={busy}
          className="min-h-[44px] flex-row items-center gap-3 rounded-card px-2 py-3 disabled:opacity-50">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
            <MaterialIcons name="photo-library" size={20} color={c.white} />
          </View>
          <Text className="font-title text-heading">Choose Photo</Text>
          {isUploading ? <ActivityIndicator className="ml-auto" color={c.inkMuted} /> : null}
        </Pressable>

        {presets && presets.length > 0 ? (
          <>
            <Text className="mt-4 mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
              Choose an Avatar
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {presets.map((preset) => (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use the ${preset.label} avatar`}
                  onPress={() => onPickPreset?.(preset.id)}
                  disabled={busy}
                  className="items-center gap-1 disabled:opacity-50">
                  <LinearGradient
                    colors={preset.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 56,
                      width: 56,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 26 }}>{preset.emoji}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {hasPhoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove current photo"
            onPress={onRemove}
            disabled={busy}
            className="mt-5 min-h-[44px] items-center justify-center rounded-card disabled:opacity-50">
            <Text className="font-title text-error">Remove Current Photo</Text>
          </Pressable>
        ) : null}

        {pickerError || saveError ? (
          <Text className="mt-3 font-body text-xs text-error">{pickerError ?? saveError}</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
