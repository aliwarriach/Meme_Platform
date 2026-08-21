import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import { WebCanvasBar } from '@/components/web/WebCanvasBar';
import { WebHashtagInput, type ChallengeTagEntry } from '@/components/web/WebHashtagInput';
import { WebLayerInspector } from '@/components/web/WebLayerInspector';
import { WebStickerPickerModal } from '@/components/web/WebStickerPickerModal';
import { WebTemplatePickerModal } from '@/components/web/WebTemplatePickerModal';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { injectFeedWebFont } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { EditorCanvas, type EditorCanvasHandle } from '@/features/creator/components/EditorCanvas';
import { aspectRatio } from '@/features/creator/document';
import { buildCreatorSchema, type CreatorFormValues } from '@/features/creator/schemas';
import { joinOpenChallengeRequest } from '@/services/challenges';
import type { AudienceType } from '@/services/memes';
import type { TemplateResponse } from '@/services/templates';
import { useGenerateCaptionMutation } from '@/services/useAiCaption';
import { useChallengeFlat, useCreateAndSubmitToChallengeMutation } from '@/services/useChallenges';
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

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Web-only sibling of `features/creator/CreatorScreen.tsx` (native-resolved, byte-for-byte
 * untouched — Expo Router's platform-extension resolution prefers this file for `new-post.web.tsx`'s
 * lazy import). Identical data/hooks/business logic (image pick, undo/redo, preview/export,
 * AI caption, personal/community/challenge publish paths); only the chrome is new — Vaporwave/
 * Luminous "Neon Plum", the same system every other web screen in this app already uses, per the
 * user's explicit "fork a new web-only creator screen" decision recorded in
 * `webFeedThemeVapor.ts`'s own file header.
 *
 * Renders inside `DesktopShell`'s content column (mounted app-wide in `app/_layout.tsx`) — no
 * width/breakpoint logic needed here. No `FloatingBottomNav`: like Voting/Friends/Inbox, this is a
 * drill-in flow with no bottom-nav destination of its own.
 */
export default function CreatorScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { communityId, communityName, challengeId } = useLocalSearchParams<{
    communityId?: string;
    communityName?: string;
    challengeId?: string;
  }>();
  const isCommunityPost = !!communityId;
  const isChallengeMode = !!challengeId;

  const { colors, type, radius, spacing, mode, toggleMode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

  useEffect(() => {
    injectFeedWebFont();
  }, []);

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
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/feed');
      }
    } catch {
      // surfaced inline via activeMutation.isError/joinError below
    }
  });

  const screenTitle = isChallengeMode
    ? (challengeQuery.data?.title ?? 'Challenge Entry')
    : isCommunityPost
      ? `New Post to ${communityName}`
      : 'New Meme';

  const ModeToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={toggleMode}
      style={({ hovered, focused }: WebPressableState) => [
        styles.iconButton,
        hovered && { backgroundColor: colors.hoverTint },
        focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
      ]}>
      <MaterialIcons name={mode === 'dark' ? 'light-mode' : 'dark-mode'} size={20} color={colors.foreground} />
    </Pressable>
  );

  if (!baseImageUri) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.iconButton,
                  hovered && { backgroundColor: colors.hoverTint },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[type.h2, styles.headerTitle]} numberOfLines={1}>
              {screenTitle}
            </Text>
            <View style={[styles.headerSide, styles.headerSideRight]}>{ModeToggle}</View>
          </View>

          <View style={styles.emptyBody}>
            <WebCompeteButton label="Upload from Gallery" onPress={onPickOwnImage} fullWidth />
            <View style={{ height: spacing.md }} />
            <WebCompeteButton
              label="Choose a Template"
              variant="outline"
              onPress={() => setTemplatePickerVisible(true)}
              fullWidth
            />

            {pickerError ? (
              <Text style={[type.body, { color: colors.error, marginTop: spacing.md }]}>{pickerError}</Text>
            ) : null}
          </View>
        </SafeAreaView>

        <WebTemplatePickerModal
          visible={templatePickerVisible}
          onClose={() => setTemplatePickerVisible(false)}
          onSelect={onSelectTemplate}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={capturedUri ? 'Edit meme' : 'Start over'}
              onPress={() => (capturedUri ? setCapturedUri(null) : onStartOver())}
              style={({ hovered, focused }: WebPressableState) => [
                styles.textButton,
                hovered && { backgroundColor: colors.hoverTint },
                focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
              ]}>
              <Text style={[type.title, { color: colors.foreground }]}>{capturedUri ? '‹ Edit' : '‹ Start over'}</Text>
            </Pressable>
          </View>
          <Text style={[type.h2, styles.headerTitle]} numberOfLines={1}>
            {capturedUri ? 'Preview' : screenTitle}
          </Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>{ModeToggle}</View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {capturedUri ? (
            <Image
              source={{ uri: capturedUri }}
              style={{ width: '100%', aspectRatio: canvasRatio, borderRadius: radius.card }}
              contentFit="contain"
              accessible
              accessibilityRole="image"
              accessibilityLabel="Preview of your meme, ready to publish"
            />
          ) : (
            <>
              <WebCanvasBar />
              <EditorCanvas ref={editorRef} />
            </>
          )}

          {!capturedUri ? (
            <>
              <View style={styles.addRow}>
                <View style={styles.addRowItem}>
                  <WebCompeteButton label="＋ Text" onPress={() => dispatch(addTextLayer())} fullWidth />
                </View>
                <View style={styles.addRowItem}>
                  <WebCompeteButton
                    label="😊 Sticker"
                    variant="outline"
                    onPress={() => setStickerPickerVisible(true)}
                    fullWidth
                  />
                </View>
                <View style={styles.addRowItem}>
                  <WebCompeteButton label="🖼 Image" variant="outline" onPress={onAddImageLayer} fullWidth />
                </View>
              </View>

              <View style={styles.undoRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Undo"
                  accessibilityState={{ disabled: !canUndo }}
                  onPress={() => dispatch(undo())}
                  disabled={!canUndo}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.roundIconButton,
                    !canUndo && styles.disabled,
                    hovered && canUndo && { backgroundColor: colors.surfaceHover },
                    focused && canUndo && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                  ]}>
                  <MaterialIcons name="undo" size={20} color={colors.foreground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Redo"
                  accessibilityState={{ disabled: !canRedo }}
                  onPress={() => dispatch(redo())}
                  disabled={!canRedo}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.roundIconButton,
                    !canRedo && styles.disabled,
                    hovered && canRedo && { backgroundColor: colors.surfaceHover },
                    focused && canRedo && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                  ]}>
                  <MaterialIcons name="redo" size={20} color={colors.foreground} />
                </Pressable>
              </View>

              <WebLayerInspector />

              <Text style={[type.meta, styles.helperText, { color: colors.foregroundMuted }]}>
                Tap a layer to select it, then drag, pinch, or rotate. Use the panel to restyle, and
                add text, stickers, or images for more layers.
              </Text>

              {captureError ? (
                <Text style={[type.body, { color: colors.error, marginBottom: spacing.md }]}>{captureError}</Text>
              ) : null}

              <WebCompeteButton label="Preview" onPress={onPreview} fullWidth />
              <View style={{ height: spacing.xxl }} />
            </>
          ) : (
            <>
              <View style={{ marginTop: spacing.lg }}>
                <Controller
                  control={control}
                  name="caption"
                  render={({ field }) => (
                    <WebCompeteTextField
                      label="Caption (optional)"
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      error={errors.caption?.message}
                      placeholder="Write a caption…"
                    />
                  )}
                />
              </View>

              <WebCompeteButton
                label={generateCaption.isPending ? 'Thinking…' : caption ? '✨ Make it funnier' : '✨ Generate a caption'}
                variant="outline"
                onPress={onGenerateCaption}
                loading={generateCaption.isPending}
                fullWidth
              />
              {generateCaption.isError ? (
                <Text style={[type.body, { color: colors.error, marginTop: spacing.sm, marginBottom: spacing.md }]}>
                  Couldn&apos;t generate a caption right now — write your own or try again.
                </Text>
              ) : (
                <View style={{ height: spacing.md }} />
              )}

              {isChallengeMode ? (
                <View style={[styles.infoCard, { borderColor: colors.indigoSecondary, backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[type.body, { color: colors.foreground }]}>
                    Competing in{' '}
                    <Text style={[type.title, { color: colors.foreground }]}>{challengeQuery.data?.title ?? '…'}</Text>
                  </Text>
                  <Text style={[type.meta, { color: colors.foregroundMuted, marginTop: spacing.xs }]}>
                    This meme is submitted straight into the challenge — no separate posting step.
                  </Text>
                </View>
              ) : isCommunityPost ? (
                <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[type.body, { color: colors.foreground }]}>
                    Posting to <Text style={[type.title, { color: colors.foreground }]}>{communityName}</Text>
                  </Text>
                  <Text style={[type.meta, { color: colors.foregroundMuted, marginTop: spacing.xs }]}>
                    Visible to this community&apos;s members. If the community is open, it also appears in the
                    public feed with a &quot;{communityName}&quot; badge.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[type.label, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>Audience</Text>
                  <View style={styles.audienceRow}>
                    {AUDIENCE_OPTIONS.map((option) => {
                      const active = selectedAudiences.includes(option.value);
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="button"
                          accessibilityLabel={`Toggle ${option.label} audience`}
                          accessibilityState={{ selected: active }}
                          onPress={() => toggleAudience(option.value)}
                          style={({ hovered, focused }: WebPressableState) => [
                            styles.audienceChip,
                            active
                              ? { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary }
                              : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                            hovered && !active && { backgroundColor: colors.surfaceHover },
                            focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                          ]}>
                          <Text style={[type.label, { color: active ? colors.onAccent : colors.foregroundMuted }]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.audiences ? (
                    <Text style={[type.body, { color: colors.error, marginBottom: spacing.sm }]}>
                      {errors.audiences.message}
                    </Text>
                  ) : null}

                  <WebHashtagInput
                    tags={tags}
                    onTagsChange={setTags}
                    challengeEntry={challengeEntry}
                    onChallengeEntryChange={setChallengeEntry}
                  />
                </>
              )}

              {joinError ? (
                <Text style={[type.body, { color: colors.error, marginBottom: spacing.md }]}>{joinError}</Text>
              ) : null}
              {activeMutation.isError ? (
                <Text style={[type.body, { color: colors.error, marginBottom: spacing.md }]}>
                  {activeMutation.error.message}
                </Text>
              ) : null}

              <WebCompeteButton
                label={activeMutation.isPending ? 'Publishing…' : 'Publish'}
                onPress={onSubmit}
                loading={activeMutation.isPending}
                fullWidth
              />
              <View style={{ height: spacing.xxl }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <WebStickerPickerModal
        visible={stickerPickerVisible}
        onClose={() => setStickerPickerVisible(false)}
        onSelect={onAddSticker}
      />
    </View>
  );
}

const createStyles = (
  colors: VaporwaveTheme['colors'],
  radius: VaporwaveTheme['radius'],
  spacing: VaporwaveTheme['spacing'],
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.gradientMid,
    },
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerSide: {
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerSideRight: {
      justifyContent: 'flex-end',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.foreground,
      paddingHorizontal: spacing.sm,
    },
    iconButton: {
      height: 40,
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    textButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
    },
    emptyBody: {
      flex: 1,
      padding: spacing.xl,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    addRow: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      gap: spacing.sm,
    },
    addRowItem: {
      flex: 1,
      minWidth: 0,
    },
    undoRow: {
      marginBottom: spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    roundIconButton: {
      height: 44,
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.borderSolid,
    },
    disabled: {
      opacity: 0.4,
    },
    helperText: {
      marginBottom: spacing.md,
    },
    infoCard: {
      marginBottom: spacing.lg,
      borderRadius: radius.card,
      borderWidth: 1,
      padding: spacing.md,
    },
    audienceRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    audienceChip: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing.lg,
    },
  });
