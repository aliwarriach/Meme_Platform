import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

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
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
        <View className="flex-1 px-6 py-4">
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-neutral-900 dark:text-white">
              Share an Instagram Reel
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-2xl text-neutral-900 dark:text-white">×</Text>
            </Pressable>
          </View>

          <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
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
            <Text className="mb-3 text-sm text-red-500">{createContainer.error.message}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share link"
            onPress={onSubmit}
            disabled={createContainer.isPending}
            className="mt-2 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50">
            <Text className="text-base font-bold text-white">
              {createContainer.isPending ? 'Sharing…' : 'Share'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
