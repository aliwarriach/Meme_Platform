import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ContainerCommentsSection } from '@/features/instagram-companion/ContainerCommentsSection';
import type { MemeContainerResponse } from '@/services/instagram';
import { useCastContainerVoteMutation } from '@/services/useCompetitions';
import {
  useAddContainerReactionMutation,
  useRemoveContainerReactionMutation,
} from '@/services/useInstagram';

interface ContainerCardProps {
  container: MemeContainerResponse;
}

// Instagram embeds require their own oEmbed HTML/JS, which the stubbed backend fetcher
// (integrations/instagram_oembed.py) doesn't provide yet — so the WebView renders the
// public post page directly (read-only preview) rather than a proper oEmbed embed. Swaps
// cleanly once real oEmbed HTML is available server-side, per the pluggable-fetcher design.
export function ContainerCard({ container }: ContainerCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const addReaction = useAddContainerReactionMutation();
  const removeReaction = useRemoveContainerReactionMutation();
  const castVote = useCastContainerVoteMutation('day');

  const isReacting = addReaction.isPending || removeReaction.isPending;

  const onToggleReaction = () => {
    if (container.viewer_has_reacted) {
      removeReaction.mutate(container.id);
    } else {
      addReaction.mutate(container.id);
    }
  };

  return (
    <View className="mb-4 border-b border-neutral-100 pb-4 dark:border-neutral-800">
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={container.viewer_has_reacted ? 'Remove reaction' : 'React to this content'}
          onPress={onToggleReaction}
          disabled={isReacting}
          className="mr-4 min-h-[44px] flex-row items-center disabled:opacity-50">
          {isReacting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text
              className={
                container.viewer_has_reacted
                  ? 'text-orange-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }>
              {container.viewer_has_reacted ? '♥' : '♡'} {container.reaction_count}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle comments"
          onPress={() => setCommentsOpen((open) => !open)}
          className="mr-4 min-h-[44px] justify-center">
          <Text className="text-neutral-500 dark:text-neutral-400">
            {container.comment_count} comment{container.comment_count === 1 ? '' : 's'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vote for Meme of the Day"
          onPress={() => castVote.mutate(container.id)}
          disabled={castVote.isPending || castVote.isSuccess}
          className="min-h-[44px] flex-row items-center disabled:opacity-50">
          {castVote.isPending ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text
              className={
                castVote.isSuccess ? 'text-orange-500' : 'text-neutral-500 dark:text-neutral-400'
              }>
              🏆 {castVote.isSuccess ? 'Voted' : 'Vote'}
            </Text>
          )}
        </Pressable>
      </View>

      {castVote.isError ? (
        <Text className="px-4 pt-1 text-xs text-red-500">{castVote.error?.message}</Text>
      ) : null}

      {commentsOpen ? <ContainerCommentsSection containerId={container.id} /> : null}
    </View>
  );
}
