import { api } from '@/services/api';

export interface CaptionSuggestionResponse {
  caption: string;
}

export function generateCaptionRequest(body: { context: string; current_caption?: string }) {
  return api.post<CaptionSuggestionResponse>('/ai-caption/generate', body);
}
