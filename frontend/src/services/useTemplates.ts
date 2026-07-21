import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  createTemplateRequest,
  getCommunityTemplatesRequest,
  getTemplatesRequest,
  type TemplatePageResponse,
  type TemplateResponse,
} from '@/services/templates';

const templatesKey = ['templates'] as const;
const communityTemplatesKey = (communityId: string) => ['templates', 'community', communityId] as const;

export function useTemplates() {
  return useInfiniteQuery<
    TemplatePageResponse,
    Error,
    InfiniteData<TemplatePageResponse>,
    typeof templatesKey,
    string | undefined
  >({
    queryKey: templatesKey,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getTemplatesRequest({ cursor: pageParam, limit: 30 });
      if (!response.ok || !response.data) throwApiError(response, 'load templates');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useCommunityTemplates(communityId: string) {
  const queryKey = communityTemplatesKey(communityId);
  return useInfiniteQuery<
    TemplatePageResponse,
    Error,
    InfiniteData<TemplatePageResponse>,
    typeof queryKey,
    string | undefined
  >({
    queryKey,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const response = await getCommunityTemplatesRequest(communityId, {
        cursor: pageParam,
        limit: 30,
      });
      if (!response.ok || !response.data) throwApiError(response, 'load community templates');
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    TemplateResponse,
    Error,
    { imageUri: string; imageName: string; imageType: string; name: string; communityId?: string }
  >({
    mutationFn: async (payload) => {
      const response = await createTemplateRequest(payload);
      if (!response.ok || !response.data) throwApiError(response, 'create template');
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.communityId) {
        queryClient.invalidateQueries({ queryKey: communityTemplatesKey(variables.communityId) });
      } else {
        queryClient.invalidateQueries({ queryKey: templatesKey });
      }
    },
  });
}
