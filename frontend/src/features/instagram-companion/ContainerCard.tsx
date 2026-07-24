import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ContainerCommentsSection } from '@/features/instagram-companion/ContainerCommentsSection';
import type { MemeContainerResponse } from '@/services/instagram';
import { useCastContainerVoteMutation, useRecordContainerViewMutation } from '@/services/useInstagram';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface ContainerCardProps {
  container: MemeContainerResponse;
}

// Instagram embeds require their own oEmbed HTML/JS, which the stubbed backend fetcher
// (integrations/instagram_oembed.py) doesn't provide yet — so the WebView renders the
// public post page directly (read-only preview) rather than a proper oEmbed embed. Swaps
// cleanly once real oEmbed HTML is available server-side, per the pluggable-fetcher design.
export function ContainerCard({ container }: ContainerCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const castVote = useCastContainerVoteMutation();
  const recordView = useRecordContainerViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(container.id));

  const isVoting = castVote.isPending;

  const onVote = (value: 1 | -1) => castVote.mutate({ containerId: container.id, value });

  return (
    <View ref={cardRef} className="mb-4 border-b border-neutral-100 pb-4 dark:border-neutral-800">
      <View className="flex-row items-center px-4 py-2">
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-pink-500">
          <Text className="text-xs font-bold text-white">IG</Text>
        </View>
        <View>
          <Text className="font-semibold text-neutral-900 dark:text-white">
            {container.submitter.username}
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            shared from Instagram
          </Text>
        </View>
      </View>

      <View style={{ width: '100%', aspectRatio: 1 }} className="bg-black">
        <WebView
          source={{ uri: container.source_url }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View className="flex-1 items-center justify-center bg-black">
              <ActivityIndicator color="white" />
            </View>
          )}
        />
      </View>

      {container.title ? (
        <Text className="px-4 pt-2 text-neutral-900 dark:text-neutral-100">{container.title}</Text>
      ) : container.metadata_status === 'pending' ? (
        <Text className="px-4 pt-2 text-xs text-neutral-400">Loading details…</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open original post on Instagram"
        onPress={() => WebBrowser.openBrowserAsync(container.source_url)}
        className="px-4 pt-1">
        <Text className="text-xs font-semibold text-orange-500">Open Original ↗</Text>
      </Pressable>

      <View className="flex-row items-center px-4 pt-2">
        <View className="mr-4 flex-row items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={container.viewer_vote === 1 ? 'Remove upvote' : 'Upvote this content'}
            accessibilityState={{ selected: container.viewer_vote === 1, disabled: isVoting }}
            onPress={() => onVote(1)}
            disabled={isVoting}
            className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50">
            <Text
              className={
                container.viewer_vote === 1
                  ? 'text-orange-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }>
              ▲
            </Text>
          </Pressable>

          {isVoting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="min-w-[24px] text-center font-semibold text-neutral-900 dark:text-white">
              {container.score}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              container.viewer_vote === -1 ? 'Remove downvote' : 'Downvote this content'
            }
            accessibilityState={{ selected: container.viewer_vote === -1, disabled: isVoting }}
            onPress={() => onVote(-1)}
            disabled={isVoting}
            className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50">
            <Text
              className={
                container.viewer_vote === -1
                  ? 'text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }>
              ▼
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle comments"
          onPress={() => setCommentsOpen((open) => !open)}
          className="mr-4 min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {container.comment_count} comment{container.comment_count === 1 ? '' : 's'}
          </Text>
        </Pressable>

        {container.view_count !== null ? (
          // Visible only to the submitter — server-gated, see services/instagram.py.
          <View className="mr-4 min-h-[44px] justify-center">
            <Text className="text-neutral-500 dark:text-neutral-400">
              👁 {container.view_count} view{container.view_count === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>

      {castVote.isError ? (
        <Text className="px-4 pt-1 text-xs text-red-500">{castVote.error?.message}</Text>
      ) : null}

      {commentsOpen ? <ContainerCommentsSection containerId={container.id} /> : null}
    </View>
  );
}
