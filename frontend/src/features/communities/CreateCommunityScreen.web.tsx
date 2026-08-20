import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import WebPillButton from '@/components/web/WebPillButton';
import WebCommunityTopBar from '@/components/web/WebCommunityTopBar';
import { WebTextField } from '@/components/web/WebTextField';
import { useCommunityWebTheme } from '@/constants/CommunityWebTheme';
import { COMMUNITY_WEB_RADIUS, COMMUNITY_WEB_SPACING, COMMUNITY_WEB_TYPE, injectCommunityWebFont, type WebPressableState } from '@/constants/webCommunityTheme';
import { createCommunitySchema, type CreateCommunityFormValues } from '@/features/communities/schemas';
import type { CommunityPrivacy } from '@/services/communities';
import { useCreateCommunityMutation } from '@/services/useCommunities';

const PRIVACY_OPTIONS: { value: CommunityPrivacy; label: string; description: string }[] = [
  { value: 'open', label: 'Open', description: 'Anyone can join instantly' },
  { value: 'invite_only', label: 'Invite only', description: 'Join requests need owner approval' },
];

/**
 * Web-only sibling of `features/communities/CreateCommunityScreen.tsx` (native-resolved,
 * untouched). Same form/validation/mutation logic (React Hook Form + Zod schema reused as-is),
 * new "Vibrant & Block-based" chrome. Centered single-column form capped at
 * `DESKTOP_MODAL_MAX_WIDTH` (480px) inside the shell's 680px content column.
 */
function CreateCommunityScreenContent() {
  const router = useRouter();
  const { colors } = useCommunityWebTheme();
  const createCommunity = useCreateCommunityMutation();
  const [pickedIcon, setPickedIcon] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    injectCommunityWebFont();
  }, []);

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
          ? { uri: pickedIcon.uri, name: pickedIcon.fileName ?? 'icon.jpg', type: pickedIcon.mimeType ?? 'image/jpeg' }
          : undefined,
      });
      router.replace({ pathname: '/communities/[id]', params: { id: community.id } });
    } catch {
      // surfaced inline via createCommunity.isError below
    }
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <WebCommunityTopBar title="New Community" showBack />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick a community icon"
            onPress={onPickIcon}
            style={({ hovered, focused }: WebPressableState) => [
              styles.iconPicker,
              { borderColor: colors.border, backgroundColor: colors.card },
              hovered && { borderColor: colors.primary },
              focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
            ]}>
            {pickedIcon ? (
              <Image source={{ uri: pickedIcon.uri }} style={styles.iconImage} contentFit="cover" />
            ) : (
              <View style={styles.iconPlaceholder}>
                <MaterialIcons name="add-a-photo" size={22} color={colors.foregroundMuted} />
                <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>Icon (optional)</Text>
              </View>
            )}
          </Pressable>
          {pickerError ? (
            <Text style={[COMMUNITY_WEB_TYPE.meta, styles.pickerError, { color: colors.destructive }]}>{pickerError}</Text>
          ) : null}

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <WebTextField label="Name" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <WebTextField
                label="Description (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={errors.description?.message}
                multiline
              />
            )}
          />

          <Text style={[COMMUNITY_WEB_TYPE.label, { color: colors.foregroundMuted, marginBottom: COMMUNITY_WEB_SPACING.sm }]}>
            Privacy
          </Text>
          <View style={styles.privacyRow}>
            {PRIVACY_OPTIONS.map((option) => {
              const selected = selectedPrivacy === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}: ${option.description}`}
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => setValue('privacy', option.value, { shouldValidate: true })}
                  style={({ hovered, focused }: WebPressableState) => [
                    styles.privacyOption,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.elevatedHover : colors.card,
                    },
                    hovered && !selected && { borderColor: colors.primary },
                    focused && { outlineColor: colors.ring, outlineWidth: 2, outlineOffset: 2 },
                  ]}>
                  <Text style={[COMMUNITY_WEB_TYPE.title, { color: selected ? colors.primary : colors.cardForeground }]}>
                    {option.label}
                  </Text>
                  <Text style={[COMMUNITY_WEB_TYPE.meta, { color: colors.foregroundMuted }]}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>

          {createCommunity.isError ? (
            <Text style={[COMMUNITY_WEB_TYPE.body, styles.submitError, { color: colors.destructive }]}>
              {createCommunity.error.message}
            </Text>
          ) : null}

          <WebPillButton
            label={createCommunity.isPending ? 'Creating…' : 'Create Community'}
            onPress={onSubmit}
            loading={createCommunity.isPending}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function CreateCommunityScreen() {
  return (
      <CreateCommunityScreenContent />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: COMMUNITY_WEB_SPACING.xl,
    paddingBottom: 80,
    alignItems: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 480,
  },
  iconPicker: {
    height: 96,
    width: 96,
    alignSelf: 'center',
    marginBottom: COMMUNITY_WEB_SPACING.lg,
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  iconPlaceholder: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: COMMUNITY_WEB_SPACING.sm,
  },
  pickerError: {
    textAlign: 'center',
    marginBottom: COMMUNITY_WEB_SPACING.sm,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: COMMUNITY_WEB_SPACING.md,
    marginBottom: COMMUNITY_WEB_SPACING.xl,
  },
  privacyOption: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    borderRadius: COMMUNITY_WEB_RADIUS.card,
    borderWidth: 1.5,
    paddingHorizontal: COMMUNITY_WEB_SPACING.lg,
    paddingVertical: COMMUNITY_WEB_SPACING.md,
    gap: 2,
  },
  submitError: {
    marginBottom: COMMUNITY_WEB_SPACING.lg,
  },
});
