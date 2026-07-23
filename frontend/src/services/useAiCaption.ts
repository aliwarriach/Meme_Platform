import { useMutation } from '@tanstack/react-query';

import { generateCaptionRequest, type CaptionSuggestionResponse } from '@/services/aiCaption';
import { throwApiError } from '@/services/api';

export function useGenerateCaptionMutation() {
  return useMutation<CaptionSuggestionResponse, Error, { context: string; currentCaption?: string }>({
    mutationFn: async ({ context, currentCaption }) => {
      const response = await generateCaptionRequest({
        context,
        current_caption: currentCaption,
      });
      if (!response.ok || !response.data) throwApiError(response, 'generate caption');
      return response.data;
    },
  });
}
