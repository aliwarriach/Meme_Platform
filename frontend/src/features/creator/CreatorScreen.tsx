import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { TextField } from '@/components/TextField';
import { OverlayCanvas } from '@/features/creator/components/OverlayCanvas';
import { TemplatePickerModal } from '@/features/creator/components/TemplatePickerModal';
import { creatorSchema, type CreatorFormValues } from '@/features/creator/schemas';
import type { AudienceType } from '@/services/memes';
import type { TemplateResponse } from '@/services/templates';
import { useCreateMemeMutation } from '@/services/useMemes';

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends' },
];

export default function CreatorScreen() {
  const router = useRouter();
  const createMeme = useCreateMemeMutation();
  const canvasRef = useRef<View>(null);

  const [baseImageUri, setBaseImageUri] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CreatorFormValues>({
    resolver: zodResolver(creatorSchema),
    defaultValues: { topText: '', bottomText: '', caption: '', audiences: [] },
  });

  const topText = watch('topText') ?? '';
  const bottomText = watch('bottomText') ?? '';
  const selectedAudiences = watch('audiences');

  const onPickOwnImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Photo library access is required to pick a meme image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPickerError(null);
      setBaseImageUri(result.assets[0].uri);
    }
  };

  const onSelectTemplate = (template: TemplateResponse) => {
    setBaseImageUri(template.image_url);
    setTemplatePickerVisible(false);
  };

  const onStartOver = () => {
    setBaseImageUri(null);
    setCapturedUri(null);
    setCaptureError(null);
    reset();
  };

  const onPreview = async () => {
    if (!canvasRef.current) return;
    setCaptureError(null);
    try {
      const uri = await captureRef(canvasRef, { format: 'png', quality: 1 });
      setCapturedUri(uri);
    } catch {
      setCaptureError('Could not generate a preview. Try again.');
    }
  };

  const toggleAudience = (value: AudienceType) => {
    const next = selectedAudiences.includes(value)
      ? selectedAudiences.filter((a) => a !== value)
      : [...selectedAudiences, value];
    setValue('audiences', next, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!capturedUri) return;
    try {
      // Publishes the exact file captured for the preview — preview and published
      // post are pixel-identical because they're the same flattened image.
      await createMeme.mutateAsync({
        imageUri: capturedUri,
        imageName: 'meme.png',
        imageType: 'image/png',
        caption: values.caption || undefined,
        audiences: values.audiences,
      });
      router.back();
    } catch {
      // surfaced inline via createMeme.isError below
    }
  });

  if (!baseImageUri) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-1 px-6 py-4">
          <View className="mb-6 flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-2xl text-neutral-900 dark:text-white">‹</Text>
            </Pressable>
            <Text className="ml-1 text-xl font-extrabold text-neutral-900 dark:text-white">
              New Meme
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload from gallery"
            onPress={onPickOwnImage}
            className="mb-3 items-center rounded-xl bg-orange-500 py-3.5">
            <Text className="text-base font-bold text-white">Upload from gallery</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a template"
            onPress={() => setTemplatePickerVisible(true)}
            className="items-center rounded-xl border border-neutral-300 py-3.5 dark:border-neutral-700">
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              Choose a template
            </Text>
          </Pressable>

          {pickerError ? <Text className="mt-3 text-sm text-red-500">{pickerError}</Text> : null}
        </View>

        <TemplatePickerModal
          visible={templatePickerVisible}
          onClose={() => setTemplatePickerVisible(false)}
          onSelect={onSelectTemplate}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView className="flex-1 px-6 py-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={capturedUri ? 'Edit meme' : 'Start over'}
            onPress={() => (capturedUri ? setCapturedUri(null) : onStartOver())}
            className="min-h-[44px] items-center justify-center">
            <Text className="text-base font-semibold text-neutral-900 dark:text-white">
              {capturedUri ? '‹ Edit' : '‹ Start over'}
            </Text>
          </Pressable>
          <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">
            {capturedUri ? 'Preview' : 'New Meme'}
          </Text>
          <View className="min-h-[44px] min-w-[44px]" />
        </View>

        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
            contentFit="contain"
          />
        ) : (
          <OverlayCanvas ref={canvasRef} imageUri={baseImageUri} topText={topText} bottomText={bottomText} />
        )}

        {!capturedUri ? (
          <>
            <Controller
              control={control}
              name="topText"
              render={({ field }) => (
                <TextField
                  label="Top text"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.topText?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="bottomText"
              render={({ field }) => (
                <TextField
                  label="Bottom text"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.bottomText?.message}
                />
              )}
            />
            <Text className="mb-3 text-xs text-neutral-400">
              Drag the text on the image to reposition it.
            </Text>

            {captureError ? <Text className="mb-3 text-sm text-red-500">{captureError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview meme"
              onPress={onPreview}
              className="mb-6 items-center rounded-xl bg-orange-500 py-3.5">
              <Text className="text-base font-bold text-white">Preview</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Controller
              control={control}
              name="caption"
              render={({ field }) => (
                <TextField
                  label="Caption (optional)"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.caption?.message}
                />
              )}
            />

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Audience
            </Text>
            <View className="mb-2 flex-row">
              {AUDIENCE_OPTIONS.map((option) => {
                const selected = selectedAudiences.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${option.label} audience`}
                    onPress={() => toggleAudience(option.value)}
                    className={`mr-2 min-h-[44px] items-center justify-center rounded-xl border px-4 ${
                      selected
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}>
                    <Text
                      className={
                        selected ? 'font-bold text-white' : 'text-neutral-900 dark:text-white'
                      }>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.audiences ? (
              <Text className="mb-2 text-sm text-red-500">{errors.audiences.message}</Text>
            ) : null}

            {createMeme.isError ? (
              <Text className="mb-4 text-sm text-red-500">{createMeme.error.message}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publish post"
              onPress={onSubmit}
              disabled={createMeme.isPending}
              className="mb-6 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
              <Text className="text-base font-bold text-white">
                {createMeme.isPending ? 'Publishing…' : 'Publish'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
