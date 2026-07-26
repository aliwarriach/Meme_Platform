import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import PillButton from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { useCreateContainerMutation } from '@/services/useInstagram';

const shareLinkSchema = z.object({
  sourceUrl: z
    .string()
    .min(1, 'Paste an Instagram link')
    .regex(/^https?:\/\/(www\.)?instagram\.com\//i, 'Must be an instagram.com link'),
});
type ShareLinkFormValues = z.infer<typeof shareLinkSchema>;

interface ShareInstagramLinkModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ShareInstagramLinkModal({ visible, onClose }: ShareInstagramLinkModalProps) {
  const createContainer = useCreateContainerMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShareLinkFormValues>({
    resolver: zodResolver(shareLinkSchema),
    defaultValues: { sourceUrl: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createContainer.mutateAsync(values.sourceUrl);
      reset({ sourceUrl: '' });
      onClose();
    } catch {
      // surfaced inline via createContainer.isError below
    }
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 px-6 py-4">
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="font-heading text-xl text-heading">Share an Instagram Reel</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center">
              <Text className="text-2xl text-heading">×</Text>
            </Pressable>
          </View>

          <Text className="mb-4 font-body text-sm text-ink-muted">
            Paste a link to an Instagram Reel or post — it&apos;ll show up in your feed with its
            own reactions and comments, and it&apos;s eligible for Meme of the Day/Week/Month.
          </Text>

          <Controller
            control={control}
            name="sourceUrl"
            render={({ field }) => (
              <TextField
                label="Instagram link"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.sourceUrl?.message}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            )}
          />

          {createContainer.isError ? (
            <Text className="mb-3 font-body text-sm text-error">{createContainer.error.message}</Text>
          ) : null}

          <PillButton
            label={createContainer.isPending ? 'Sharing…' : 'Add to Feed'}
            onPress={onSubmit}
            loading={createContainer.isPending}
            className="mt-2"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
