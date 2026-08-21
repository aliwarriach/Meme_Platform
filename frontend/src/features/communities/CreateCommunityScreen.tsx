import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useThemeMode } from '@/constants/ThemeMode';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import { createCommunitySchema, type CreateCommunityFormValues } from '@/features/communities/schemas';
import type { CommunityPrivacy } from '@/services/communities';
import { useCreateCommunityMutation } from '@/services/useCommunities';

const PRIVACY_OPTIONS: { value: CommunityPrivacy; label: string; description: string }[] = [
  { value: 'open', label: 'Open', description: 'Anyone can join instantly' },
  { value: 'invite_only', label: 'Invite only', description: 'Join requests need owner approval' },
];

export default function CreateCommunityScreen() {
  const router = useRouter();
  const createCommunity = useCreateCommunityMutation();
  const [pickedIcon, setPickedIcon] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const { mode } = useThemeMode();
  const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateCommunityFormValues>({
    resolver: zodResolver(createCommunitySchema),
    defaultValues: { name: '', description: '', privacy: 'open' },
  });

  const selectedPrivacy = watch('privacy');

  const onPickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Photo library access is required to pick an icon.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPickerError(null);
      setPickedIcon(result.assets[0]);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const community = await createCommunity.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        privacy: values.privacy,
        icon: pickedIcon
          ? {
              uri: pickedIcon.uri,
              name: pickedIcon.fileName ?? 'icon.jpg',
              type: pickedIcon.mimeType ?? 'image/jpeg',
            }
          : undefined,
      });
      router.replace({ pathname: '/communities/[id]', params: { id: community.id } });
    } catch {
      // surfaced inline via createCommunity.isError below
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <TopBar title="New Community" showBack />
      <ScrollView className="flex-1 px-6 py-4" keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a community icon"
          onPress={onPickIcon}
          className="mb-4 h-24 w-24 items-center justify-center self-center overflow-hidden rounded-full border border-dashed border-outline">
          {pickedIcon ? (
            <Image
              source={{ uri: pickedIcon.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="items-center gap-1 px-2">
              <MaterialIcons name="add-a-photo" size={20} color={c.inkMuted} />
              <Text className="text-center font-body text-xs text-ink-muted">Icon (optional)</Text>
            </View>
          )}
        </Pressable>
        {pickerError ? <Text className="mb-2 font-body text-sm text-error">{pickerError}</Text> : null}

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              label="Name"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label="Description (optional)"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.description?.message}
            />
          )}
        />

        <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">Privacy</Text>
        <View className="mb-6 flex-row gap-3">
          {PRIVACY_OPTIONS.map((option) => {
            const selected = selectedPrivacy === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label}: ${option.description}`}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => setValue('privacy', option.value, { shouldValidate: true })}
                className={`flex-1 min-h-[64px] justify-center rounded-card border px-4 py-2 ${
                  selected ? 'border-primary bg-primary/15' : 'border-outline-variant bg-surface-high/40'
                }`}>
                <Text className={`font-title ${selected ? 'text-primary-dim' : 'text-heading'}`}>
                  {option.label}
                </Text>
                <Text className="font-body text-xs text-ink-muted">{option.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {createCommunity.isError ? (
          <Text className="mb-4 font-body text-sm text-error">{createCommunity.error.message}</Text>
        ) : null}

        <PillButton
          label={createCommunity.isPending ? 'Creating…' : 'Create Community'}
          onPress={onSubmit}
          loading={createCommunity.isPending}
          className="mb-6"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
