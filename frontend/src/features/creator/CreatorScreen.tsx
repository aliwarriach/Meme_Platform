import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import Chip from '@/components/Chip';
import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import TopBar from '@/components/TopBar';
import { CanvasBar } from '@/features/creator/components/CanvasBar';
import { EditorCanvas, type EditorCanvasHandle } from '@/features/creator/components/EditorCanvas';
import { LayerInspector } from '@/features/creator/components/LayerInspector';
import { StickerPickerModal } from '@/features/creator/components/StickerPickerModal';
import { TemplatePickerModal } from '@/features/creator/components/TemplatePickerModal';
import { aspectRatio } from '@/features/creator/document';
import { buildCreatorSchema, type CreatorFormValues } from '@/features/creator/schemas';
import {
  HashtagInput,
  type ChallengeTagEntry,
} from '@/features/challenges/components/HashtagInput';
import { joinOpenChallengeRequest } from '@/services/challenges';
import type { AudienceType } from '@/services/memes';
import type { TemplateResponse } from '@/services/templates';
import { useGenerateCaptionMutation } from '@/services/useAiCaption';
import {
  useChallengeFlat,
  useCreateAndSubmitToChallengeMutation,
} from '@/services/useChallenges';
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
  const { communityId, communityName, challengeId } = useLocalSearchParams<{
    communityId?: string;
    communityName?: string;
    challengeId?: string;
  }>();
  // Posting from inside a community has no manual audience picker — visibility is
  // fully derived server-side from the community's privacy setting.
  const isCommunityPost = !!communityId;
  // Entered from a challenge (the "Create a meme for this challenge" CTA) — publish
  // submits directly into it instead of the normal audience-based post.
  const isChallengeMode = !!challengeId;

  const createMeme = useCreateMemeMutation();
  const createCommunityMeme = useCreateCommunityMemeMutation();
  const createAndSubmitToChallenge = useCreateAndSubmitToChallengeMutation();
  const activeMutation = isChallengeMode
    ? createAndSubmitToChallenge
    : isCommunityPost
      ? createCommunityMeme
      : createMeme;
  const generateCaption = useGenerateCaptionMutation();
  const challengeQuery = useChallengeFlat(challengeId ?? '');

  const [tags, setTags] = useState<string[]>([]);
  const [challengeEntry, setChallengeEntry] = useState<ChallengeTagEntry | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

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

  const schema = useMemo(
    () => buildCreatorSchema(!isCommunityPost && !isChallengeMode),
    [isCommunityPost, isChallengeMode]
  );

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
    setJoinError(null);
    try {
      if (isChallengeMode && challengeId) {
        await createAndSubmitToChallenge.mutateAsync({
          challengeId,
          image: { uri: capturedUri, name: 'meme.png', type: 'image/png' },
          caption: values.caption || undefined,
        });
      } else if (challengeEntry) {
        // Typed tag resolved to a challenge — join first (a re-join of the same side the
        // user just picked is expected and treated as success, not an error: the pick
        // itself already happened in the tag picker, this just makes sure the roster row
        // exists before submitting), then submit through the same path as the explicit CTA.
        const joinResponse = await joinOpenChallengeRequest(challengeEntry.challengeId, challengeEntry.sideId);
        if (!joinResponse.ok && joinResponse.status !== 400) {
          setJoinError(`Couldn't enter ${challengeEntry.challengeTitle} — try again.`);
          return;
        }
        await createAndSubmitToChallenge.mutateAsync({
          challengeId: challengeEntry.challengeId,
          image: { uri: capturedUri, name: 'meme.png', type: 'image/png' },
          caption: values.caption || undefined,
        });
      } else if (isCommunityPost) {
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
          hashtags: tags,
        });
      }
      dispatch(resetDraft());
      router.back();
    } catch {
      // surfaced inline via activeMutation.isError/joinError below
    }
  });

  if (!baseImageUri) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <TopBar
          title={
            isChallengeMode
              ? (challengeQuery.data?.title ?? 'Challenge Entry')
              : isCommunityPost
                ? `New Post to ${communityName}`
                : 'New Meme'
          }
          showBack
        />
        <View className="flex-1 px-6 py-4">
          <PillButton label="Upload from Gallery" onPress={onPickOwnImage} className="mb-3" />
          <PillButton
            label="Choose a Template"
            variant="outline"
            onPress={() => setTemplatePickerVisible(true)}
          />

          {pickerError ? <Text className="mt-3 font-body text-sm text-error">{pickerError}</Text> : null}
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between border-b border-outline-variant/30 px-4 pb-3 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={capturedUri ? 'Edit meme' : 'Start over'}
          onPress={() => (capturedUri ? setCapturedUri(null) : onStartOver())}
          className="min-h-[44px] items-center justify-center">
          <Text className="font-title text-base text-heading">{capturedUri ? '‹ Edit' : '‹ Start over'}</Text>
        </Pressable>
        <Text className="font-heading text-lg text-heading">
          {capturedUri
            ? 'Preview'
            : isChallengeMode
              ? (challengeQuery.data?.title ?? 'Challenge Entry')
              : isCommunityPost
                ? `New Post to ${communityName}`
                : 'New Meme'}
        </Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="min-h-[44px] min-w-[44px]"
        />
      </View>

      <ScrollView className="flex-1 px-6 py-4" keyboardShouldPersistTaps="handled">
        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={{ width: '100%', aspectRatio: canvasRatio, borderRadius: 24 }}
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
            <View className="mb-2 mt-3 flex-row gap-2">
              <PillButton label="＋ Text" className="flex-1" onPress={() => dispatch(addTextLayer())} />
              <PillButton
                label="😊 Sticker"
                variant="outline"
                className="flex-1"
                onPress={() => setStickerPickerVisible(true)}
              />
              <PillButton label="🖼 Image" variant="outline" className="flex-1" onPress={onAddImageLayer} />
            </View>

            <View className="mb-3 flex-row justify-end gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo"
                onPress={() => dispatch(undo())}
                disabled={!canUndo}
                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-outline-variant px-3 disabled:opacity-40">
                <Text className="font-title text-base text-heading">↶</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Redo"
                onPress={() => dispatch(redo())}
                disabled={!canRedo}
                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-outline-variant px-3 disabled:opacity-40">
                <Text className="font-title text-base text-heading">↷</Text>
              </Pressable>
            </View>

            <LayerInspector />

            <Text className="mb-3 font-body text-xs text-ink-muted">
              Tap a layer to select it, then drag, pinch, or rotate. Use the panel to restyle, and
              add text, stickers, or images for more layers.
            </Text>

            {captureError ? <Text className="mb-3 font-body text-sm text-error">{captureError}</Text> : null}

            <PillButton label="Preview" onPress={onPreview} className="mb-6" />
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

            <PillButton
              label={
                generateCaption.isPending
                  ? 'Thinking…'
                  : caption
                    ? '✨ Make it funnier'
                    : '✨ Generate a caption'
              }
              variant="outline"
              onPress={onGenerateCaption}
              loading={generateCaption.isPending}
              className="mb-2"
            />
            {generateCaption.isError ? (
              <Text className="mb-3 font-body text-sm text-error">
                Couldn&apos;t generate a caption right now — write your own or try again.
              </Text>
            ) : null}

            {isChallengeMode ? (
              <View className="mb-4 rounded-card border border-primary/40 bg-primary/10 px-4 py-3">
                <Text className="font-body text-sm text-ink">
                  Competing in{' '}
                  <Text className="font-title text-heading">
                    {challengeQuery.data?.title ?? '…'}
                  </Text>
                </Text>
                <Text className="mt-1 font-body text-xs text-ink-muted">
                  This meme is submitted straight into the challenge — no separate posting step.
                </Text>
              </View>
            ) : isCommunityPost ? (
              <View className="mb-4 rounded-card bg-surface-high/60 px-4 py-3">
                <Text className="font-body text-sm text-ink">
                  Posting to <Text className="font-title text-heading">{communityName}</Text>
                </Text>
                <Text className="mt-1 font-body text-xs text-ink-muted">
                  Visible to this community&apos;s members. If the community is open, it also
                  appears in the public feed with a &quot;{communityName}&quot; badge.
                </Text>
              </View>
            ) : (
              <>
                <Text className="mb-2 font-label text-xs uppercase tracking-wide text-ink-muted">
                  Audience
                </Text>
                <View className="mb-2 flex-row gap-2">
                  {AUDIENCE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={selectedAudiences.includes(option.value)}
                      accessibilityLabel={`Toggle ${option.label} audience`}
                      onPress={() => toggleAudience(option.value)}
                    />
                  ))}
                </View>
                {errors.audiences ? (
                  <Text className="mb-2 font-body text-sm text-error">{errors.audiences.message}</Text>
                ) : null}

                <HashtagInput
                  tags={tags}
                  onTagsChange={setTags}
                  challengeEntry={challengeEntry}
                  onChallengeEntryChange={setChallengeEntry}
                />
              </>
            )}

            {joinError ? <Text className="mb-4 font-body text-sm text-error">{joinError}</Text> : null}
            {activeMutation.isError ? (
              <Text className="mb-4 font-body text-sm text-error">{activeMutation.error.message}</Text>
            ) : null}

            <PillButton
              label={activeMutation.isPending ? 'Publishing…' : 'Publish'}
              onPress={onSubmit}
              loading={activeMutation.isPending}
              className="mb-6"
            />
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
