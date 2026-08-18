import { ActivityIndicator, ScrollView, Text } from 'react-native';

import { useCompeteWebTheme } from '@/constants/CompeteWebTheme';
import { COMPETE_WEB_TYPE } from '@/constants/webCompeteTheme';
import { WebSubmissionThumb } from '@/components/web/WebSubmissionThumb';
import type { MemeResponse } from '@/services/memes';

interface WebSubmissionPickerProps {
  memes: MemeResponse[];
  isLoading: boolean;
  isSubmitting: boolean;
  submittedMemeIds: Set<string>;
  onSubmit: (memeId: string) => void;
}

/** Replaces native `components/SubmissionPicker.tsx` for `ChallengeDetailScreen.web.tsx` — same
 * data source (the viewer's own memes from the community feed) and behavior, new chrome via
 * `WebSubmissionThumb`. */
export function WebSubmissionPicker({ memes, isLoading, isSubmitting, submittedMemeIds, onSubmit }: WebSubmissionPickerProps) {
  const { colors } = useCompeteWebTheme();

  if (isLoading) return <ActivityIndicator style={{ marginVertical: 16 }} color={colors.foregroundMuted} />;

  if (memes.length === 0) {
    return (
      <Text style={[COMPETE_WEB_TYPE.body, { color: colors.foregroundMuted, marginBottom: 16 }]}>
        Post a meme in this community first, then come back here to submit it.
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      {memes.map((meme) => {
        const alreadySubmitted = submittedMemeIds.has(meme.id);
        return (
          <WebSubmissionThumb
            key={meme.id}
            imageUrl={meme.image_url}
            footerLabel={alreadySubmitted ? 'Submitted' : 'Submit'}
            disabled={isSubmitting || alreadySubmitted}
            onPress={() => onSubmit(meme.id)}
          />
        );
      })}
    </ScrollView>
  );
}
