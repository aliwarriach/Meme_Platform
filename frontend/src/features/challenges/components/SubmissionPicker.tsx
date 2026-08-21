import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { useColorScheme } from 'nativewind';

import { NEON_PLUM_DARK, NEON_PLUM_LIGHT } from '@/constants/theme';
import type { MemeResponse } from '@/services/memes';

interface SubmissionPickerProps {
  memes: MemeResponse[];
  isLoading: boolean;
  isSubmitting: boolean;
  submittedMemeIds: Set<string>;
  onSubmit: (memeId: string) => void;
}

// Own memes are sourced from the community feed rather than a dedicated "my memes"
// endpoint — this phase reuses what already exists instead of adding new backend
// surface for a picker that only needs images the user already posted in this community.
export function SubmissionPicker({
  memes,
  isLoading,
  isSubmitting,
  submittedMemeIds,
  onSubmit,
}: SubmissionPickerProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
  if (isLoading) return <ActivityIndicator className="my-4" color={c.inkMuted} />;

  if (memes.length === 0) {
    return (
      <Text className="mb-4 font-body text-sm text-ink-muted">
        Post a meme in this community first, then come back here to submit it.
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
      {memes.map((meme) => {
        const alreadySubmitted = submittedMemeIds.has(meme.id);
        return (
          <Pressable
            key={meme.id}
            accessibilityRole="button"
            accessibilityLabel={alreadySubmitted ? 'Already submitted' : 'Submit this meme'}
            disabled={isSubmitting || alreadySubmitted}
            onPress={() => onSubmit(meme.id)}
            className="mr-3 items-center disabled:opacity-40">
            <Image
              source={{ uri: meme.image_url }}
              style={{ width: 88, height: 88, borderRadius: 16 }}
              contentFit="cover"
            />
            <Text className="mt-1 font-body text-xs text-ink-muted">
              {alreadySubmitted ? 'Submitted' : 'Submit'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
