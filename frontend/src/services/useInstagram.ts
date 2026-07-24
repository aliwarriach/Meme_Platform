import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { throwApiError } from '@/services/api';
import {
  addContainerCommentRequest,
  castContainerVoteRequest,
  createContainerRequest,
  getContainerRequest,
  listContainerCommentsRequest,
  recordContainerViewRequest,
  type ContainerCommentResponse,
  type ContainerViewResponse,
  type MemeContainerResponse,
} from '@/services/instagram';

const feedKey = ['memes', 'feed'] as const;
const containerKey = (containerId: string) => ['instagram', 'containers', containerId] as const;
const containerCommentsKey = (containerId: string) =>
  ['instagram', 'containers', containerId, 'comments'] as const;

export function useCreateContainerMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeContainerResponse, Error, string>({
    mutationFn: async (sourceUrl) => {
      const response = await createContainerRequest(sourceUrl);
      if (!response.ok || !response.data) throwApiError(response, 'share Instagram link');
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

export function useContainer(containerId: string, enabled: boolean) {
  return useQuery<MemeContainerResponse, Error>({
    queryKey: containerKey(containerId),
    queryFn: async () => {
      const response = await getContainerRequest(containerId);
      if (!response.ok || !response.data) throwApiError(response, 'load Instagram content');
      return response.data;
    },
    enabled,
    // Metadata fetch is a fire-and-forget background task server-side — poll briefly
    // while still pending so the title/thumbnail fill in without a manual refresh.
    refetchInterval: (query) => (query.state.data?.metadata_status === 'pending' ? 2000 : false),
  });
}

export function useCastContainerVoteMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemeContainerResponse, Error, { containerId: string; value: 1 | -1 }>({
    mutationFn: async ({ containerId, value }) => {
      const response = await castContainerVoteRequest(containerId, value);
      if (!response.ok || !response.data) throwApiError(response, 'vote on this content');
      return response.data;
    },
    onSuccess: (_data, { containerId }) => {
      queryClient.invalidateQueries({ queryKey: feedKey });
      queryClient.invalidateQueries({ queryKey: containerKey(containerId) });
    },
  });
}

// Fire-and-forget, same rationale as useRecordMemeViewMutation — no cache invalidation, or
// the merged feed would refetch on every container impression.
export function useRecordContainerViewMutation() {
  return useMutation<ContainerViewResponse, Error, string>({
    mutationFn: async (containerId) => {
      const response = await recordContainerViewRequest(containerId);
      if (!response.ok || !response.data) throwApiError(response, 'record view');
      return response.data;
    },
  });
}

export function useContainerComments(containerId: string, enabled: boolean) {
  return useQuery<ContainerCommentResponse[], Error>({
    queryKey: containerCommentsKey(containerId),
    queryFn: async () => {
      const response = await listContainerCommentsRequest(containerId);
      if (!response.ok || !response.data) throwApiError(response, 'load comments');
      return response.data;
    },
    enabled,
  });
}

export function useAddContainerCommentMutation(containerId: string) {
  const queryClient = useQueryClient();
  return useMutation<ContainerCommentResponse, Error, string>({
    mutationFn: async (body) => {
      const response = await addContainerCommentRequest(containerId, body);
      if (!response.ok || !response.data) throwApiError(response, 'add comment');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: containerCommentsKey(containerId) });
      queryClient.invalidateQueries({ queryKey: containerKey(containerId) });
      queryClient.invalidateQueries({ queryKey: feedKey });
    },
  });
}
