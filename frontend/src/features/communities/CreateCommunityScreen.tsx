import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/TextField';
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
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView className="flex-1 px-6 py-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
          </Pressable>
          <Text className="ml-1 text-xl font-extrabold text-neutral-900 dark:text-white">
            New Community
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a community icon"
          onPress={onPickIcon}
          className="mb-4 h-24 w-24 items-center justify-center self-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
          {pickedIcon ? (
            <Image
              source={{ uri: pickedIcon.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Text className="px-2 text-center text-xs text-neutral-400">Icon (optional)</Text>
          )}
        </Pressable>
        {pickerError ? <Text className="mb-2 text-sm text-red-500">{pickerError}</Text> : null}

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

        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Privacy
        </Text>
        <View className="mb-6">
          {PRIVACY_OPTIONS.map((option) => {
            const selected = selectedPrivacy === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label}: ${option.description}`}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => setValue('privacy', option.value, { shouldValidate: true })}
                className={`mb-2 min-h-[56px] justify-center rounded-xl border px-4 py-2 ${
                  selected
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}>
                <Text
                  className={`font-bold ${selected ? 'text-orange-500' : 'text-neutral-900 dark:text-white'}`}>
                  {option.label}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {createCommunity.isError ? (
          <Text className="mb-4 text-sm text-red-500">{createCommunity.error.message}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create community"
          onPress={onSubmit}
          disabled={createCommunity.isPending}
          className="mb-6 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
          <Text className="text-base font-bold text-white">
            {createCommunity.isPending ? 'Creating…' : 'Create community'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
