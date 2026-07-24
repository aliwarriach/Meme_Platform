import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { TextField } from '@/components/TextField';
import { CanvasBar } from '@/features/creator/components/CanvasBar';
import { EditorCanvas, type EditorCanvasHandle } from '@/features/creator/components/EditorCanvas';
import { LayerInspector } from '@/features/creator/components/LayerInspector';
import { StickerPickerModal } from '@/features/creator/components/StickerPickerModal';
import { TemplatePickerModal } from '@/features/creator/components/TemplatePickerModal';
import { aspectRatio } from '@/features/creator/document';
import { buildCreatorSchema, type CreatorFormValues } from '@/features/creator/schemas';
import type { AudienceType } from '@/services/memes';
import type { TemplateResponse } from '@/services/templates';
import { useGenerateCaptionMutation } from '@/services/useAiCaption';
import { useCreateCommunityMemeMutation, useCreateMemeMutation } from '@/services/useMemes';
import {
  addEmojiLayer,
  addImageLayer,
  addTextLayer,
  redo,
  resetDraft,
  selectCanRedo,
  selectCanUndo,
  selectDocument,
  setBaseImage,
  undo,
} from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends' },
];

export default function CreatorScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { communityId, communityName } = useLocalSearchParams<{
    communityId?: string;
    communityName?: string;
  }>();
  // Posting from inside a community has no manual audience picker — visibility is
  // fully derived server-side from the community's privacy setting.
  const isCommunityPost = !!communityId;

  const createMeme = useCreateMemeMutation();
  const createCommunityMeme = useCreateCommunityMemeMutation();
  const activeMutation = isCommunityPost ? createCommunityMeme : createMeme;
  const generateCaption = useGenerateCaptionMutation();

  const editorRef = useRef<EditorCanvasHandle>(null);

  const doc = useSelector(selectDocument);
  const canUndo = useSelector(selectCanUndo);
  const canRedo = useSelector(selectCanRedo);
  const baseImageUri = doc.baseImageUri;
  const canvasRatio = aspectRatio(doc.canvas.aspectId);

  const [pickerError, setPickerError] = useState<string | null>(null);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Start every creator session from a clean draft so a previous, unpublished draft
  // (or another community's image) never leaks into this one.
  useEffect(() => {
    dispatch(resetDraft());
  }, [dispatch]);

  const schema = useMemo(() => buildCreatorSchema(!isCommunityPost), [isCommunityPost]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CreatorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { caption: '', audiences: [] },
  });

  const caption = watch('caption') ?? '';
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
      dispatch(setBaseImage(result.assets[0].uri));
    }
  };

  const onSelectTemplate = (template: TemplateResponse) => {
    dispatch(setBaseImage(template.image_url));
    setTemplatePickerVisible(false);
  };

  // Adds a picked photo as a movable image *layer* on top of the meme (distinct from
  // setBaseImage, which replaces the background).
  const onAddImageLayer = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Photo library access is required to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPickerError(null);
      dispatch(addImageLayer(result.assets[0].uri));
    }
  };

  const onAddSticker = (emoji: string) => {
    dispatch(addEmojiLayer(emoji));
    setStickerPickerVisible(false);
  };

  const onStartOver = () => {
    dispatch(resetDraft());
    setCapturedUri(null);
    setCaptureError(null);
    reset();
  };

  const onPreview = async () => {
    setCaptureError(null);
    try {
      // Flattens the exact Skia scene being edited to a 1080² PNG — preview and
      // published post are the same file, so they're pixel-identical.
      const uri = await editorRef.current?.export();
      if (uri) setCapturedUri(uri);
    } catch {
      setCaptureError('Could not generate a preview. Try again.');
    }
  };

  const onGenerateCaption = async () => {
    const context =
      doc.layers
        .flatMap((layer) => (layer.kind === 'text' ? [layer.text] : []))
        .filter(Boolean)
        .join(' / ') || 'a meme image';
    try {
      const result = await generateCaption.mutateAsync({
        context,
        currentCaption: caption || undefined,
      });
      setValue('caption', result.caption, { shouldValidate: true });
    } catch {
      // surfaced inline via generateCaption.isError below
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
      if (isCommunityPost) {
        await createCommunityMeme.mutateAsync({
          communityId,
          imageUri: capturedUri,
          imageName: 'meme.png',
          imageType: 'image/png',
          caption: values.caption || undefined,
        });
      } else {
        await createMeme.mutateAsync({
          imageUri: capturedUri,
          imageName: 'meme.png',
          imageType: 'image/png',
          caption: values.caption || undefined,
          audiences: values.audiences,
        });
      }
      dispatch(resetDraft());
      router.back();
    } catch {
      // surfaced inline via activeMutation.isError below
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
              {isCommunityPost ? `New Post to ${communityName}` : 'New Meme'}
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
            {capturedUri ? 'Preview' : isCommunityPost ? `New Post to ${communityName}` : 'New Meme'}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="min-h-[44px] min-w-[44px]"
          />
        </View>

        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={{ width: '100%', aspectRatio: canvasRatio, borderRadius: 12 }}
            contentFit="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Preview of your meme, ready to publish"
          />
        ) : (
          <>
            <CanvasBar />
            <EditorCanvas ref={editorRef} />
          </>
        )}

        {!capturedUri ? (
          <>
            <View className="mb-2 mt-3 flex-row">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add text layer"
                onPress={() => dispatch(addTextLayer())}
                className="mr-2 min-h-[44px] flex-1 items-center justify-center rounded-xl bg-orange-500 px-2">
                <Text className="text-sm font-bold text-white">＋ Text</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add sticker"
                onPress={() => setStickerPickerVisible(true)}
                className="mr-2 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-neutral-300 px-2 dark:border-neutral-700">
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">😊 Sticker</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add image layer"
                onPress={onAddImageLayer}
                className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-neutral-300 px-2 dark:border-neutral-700">
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">🖼 Image</Text>
              </Pressable>
            </View>

            <View className="mb-3 flex-row justify-end">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo"
                onPress={() => dispatch(undo())}
                disabled={!canUndo}
                className="mr-2 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-300 px-3 disabled:opacity-40 dark:border-neutral-700">
                <Text className="text-base font-bold text-neutral-900 dark:text-white">↶</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Redo"
                onPress={() => dispatch(redo())}
                disabled={!canRedo}
                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-300 px-3 disabled:opacity-40 dark:border-neutral-700">
                <Text className="text-base font-bold text-neutral-900 dark:text-white">↷</Text>
              </Pressable>
            </View>

            <LayerInspector />

            <Text className="mb-3 text-xs text-neutral-400">
              Tap a layer to select it, then drag, pinch, or rotate. Use the panel to restyle, and
              add text, stickers, or images for more layers.
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={caption ? 'Make caption funnier' : 'Generate a caption'}
              onPress={onGenerateCaption}
              disabled={generateCaption.isPending}
              className="mb-2 min-h-[44px] items-center justify-center rounded-xl border border-orange-500 py-2.5 disabled:opacity-50">
              <Text className="text-sm font-bold text-orange-500">
                {generateCaption.isPending
                  ? 'Thinking…'
                  : caption
                    ? '✨ Make it funnier'
                    : '✨ Generate a caption'}
              </Text>
            </Pressable>
            {generateCaption.isError ? (
              <Text className="mb-3 text-sm text-red-500">
                Couldn&apos;t generate a caption right now — write your own or try again.
              </Text>
            ) : null}

            {isCommunityPost ? (
              <View className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                  Posting to <Text className="font-bold">{communityName}</Text>
                </Text>
                <Text className="mt-1 text-xs text-neutral-400">
                  Visible to this community&apos;s members. If the community is open, it also
                  appears in the public feed with a &quot;{communityName}&quot; badge.
                </Text>
              </View>
            ) : (
              <>
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
              </>
            )}

            {activeMutation.isError ? (
              <Text className="mb-4 text-sm text-red-500">{activeMutation.error.message}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publish post"
              onPress={onSubmit}
              disabled={activeMutation.isPending}
              className="mb-6 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
              <Text className="text-base font-bold text-white">
                {activeMutation.isPending ? 'Publishing…' : 'Publish'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <StickerPickerModal
        visible={stickerPickerVisible}
        onClose={() => setStickerPickerVisible(false)}
        onSelect={onAddSticker}
      />
    </SafeAreaView>
  );
}
