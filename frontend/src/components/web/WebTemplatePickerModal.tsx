import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import WebCompeteButton from '@/components/web/WebCompeteButton';
import { WebCompeteTextField } from '@/components/web/WebCompeteTextField';
import WebModalFrame from '@/components/web/WebModalFrame';
import { WebTemplateGrid } from '@/components/web/WebTemplateGrid';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { TemplateResponse } from '@/services/templates';
import { useMyCommunities } from '@/services/useCommunities';
import { useCommunityTemplates, useCreateTemplateMutation, useTemplates } from '@/services/useTemplates';

interface WebTemplatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: TemplateResponse) => void;
}

type Scope = { type: 'global' } | { type: 'community'; communityId: string; communityName: string };

interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

function GlobalTemplates({ onSelect }: { onSelect: (template: TemplateResponse) => void }) {
  const query = useTemplates();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <WebTemplateGrid
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
    <WebTemplateGrid
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

/** Themed replacement for `features/creator/components/TemplatePickerModal.tsx` — same
 * Global/per-community scope + inline upload flow + paginated grid, now Vaporwave/Luminous
 * chrome inside the already-established `WebModalFrame` dialog. */
export function WebTemplatePickerModal({ visible, onClose, onSelect }: WebTemplatePickerModalProps) {
  const { colors, type, radius, spacing, mode } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(colors, radius, spacing), [colors, radius, spacing]);
  const ringColor = mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary;

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
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      <WebModalFrame>
        <View style={[styles.root, { backgroundColor: colors.surfaceSolid }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[type.h2, { color: colors.foreground }]}>Choose a Template</Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={uploadOpen ? 'Cancel template upload' : 'Add a new template'}
                onPress={() => setUploadOpen((open) => !open)}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.iconButton,
                  hovered && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <MaterialIcons name={uploadOpen ? 'close' : 'add'} size={22} color={colors.indigoPrimary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close template picker"
                onPress={onClose}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.doneButton,
                  hovered && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <Text style={[type.title, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.scopeScroll, !uploadOpen && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            contentContainerStyle={styles.scopeScrollContent}>
            <View style={styles.scopeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Global templates"
                accessibilityState={{ selected: scope.type === 'global' }}
                onPress={() => setScope({ type: 'global' })}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.scopeChip,
                  scope.type === 'global'
                    ? { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary }
                    : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                  hovered && scope.type !== 'global' && { backgroundColor: colors.surfaceHover },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                <Text style={[type.label, { color: scope.type === 'global' ? colors.onAccent : colors.foregroundMuted }]}>
                  Global
                </Text>
              </Pressable>
              {myCommunities.map((community) => {
                const active = scope.type === 'community' && scope.communityId === community.id;
                return (
                  <Pressable
                    key={community.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${community.name} templates`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setScope({ type: 'community', communityId: community.id, communityName: community.name })}
                    style={({ hovered, focused }: WebPressableState) => [
                      styles.scopeChip,
                      active
                        ? { backgroundColor: colors.indigoSecondary, borderColor: colors.indigoSecondary }
                        : { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSolid },
                      hovered && !active && { backgroundColor: colors.surfaceHover },
                      focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                    ]}>
                    <Text style={[type.label, { color: active ? colors.onAccent : colors.foregroundMuted }]}>
                      {community.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {uploadOpen ? (
            <View style={[styles.uploadBlock, { borderBottomColor: colors.border }]}>
              <Text style={[type.meta, { color: colors.foregroundMuted, marginBottom: spacing.sm }]}>
                {scope.type === 'community'
                  ? `Uploading to ${scope.communityName}'s private library`
                  : 'Uploading to the global library'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick a template image"
                onPress={onPickUploadImage}
                style={({ hovered, focused }: WebPressableState) => [
                  styles.picker,
                  { borderColor: colors.borderSolid },
                  hovered && { borderColor: colors.indigoPrimary },
                  focused && { outlineColor: ringColor, outlineWidth: 2, outlineOffset: 1 },
                ]}>
                {pickedImage ? (
                  <Image source={{ uri: pickedImage.uri }} style={styles.pickerImage} contentFit="cover" />
                ) : (
                  <Text style={[type.body, { color: colors.foregroundMuted }]}>Tap to choose an image</Text>
                )}
              </Pressable>
              <WebCompeteTextField label="Template name" value={newName} onChangeText={setNewName} placeholder="My great template" />
              {uploadError ? (
                <Text style={[type.meta, { color: colors.error, marginBottom: spacing.sm }]}>{uploadError}</Text>
              ) : null}
              <WebCompeteButton
                label={createTemplate.isPending ? 'Uploading…' : 'Upload Template'}
                onPress={onSubmitUpload}
                loading={createTemplate.isPending}
              />
            </View>
          ) : null}

          {scope.type === 'global' ? (
            <GlobalTemplates onSelect={onSelect} />
          ) : (
            <CommunityTemplates communityId={scope.communityId} onSelect={onSelect} />
          )}
        </View>
      </WebModalFrame>
    </Modal>
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconButton: {
      height: 44,
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    doneButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    scopeScroll: {
      flexGrow: 0,
    },
    scopeScrollContent: {
      paddingVertical: spacing.md,
    },
    scopeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    scopeChip: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
    },
    uploadBlock: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
    },
    picker: {
      height: 112,
      marginBottom: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: radius.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
    },
    pickerImage: {
      width: '100%',
      height: '100%',
    },
  });
