import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';

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
  if (isLoading) return <ActivityIndicator className="my-4" />;

  if (memes.length === 0) {
    return (
      <Text className="mb-4 text-sm text-neutral-400">
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
              style={{ width: 88, height: 88, borderRadius: 12 }}
              contentFit="cover"
            />
            <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {alreadySubmitted ? 'Submitted' : 'Submit'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
