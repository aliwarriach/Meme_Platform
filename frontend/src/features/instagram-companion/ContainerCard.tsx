import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import VotePill from '@/components/VotePill';
import { ContainerCommentsSection } from '@/features/instagram-companion/ContainerCommentsSection';
import type { MemeContainerResponse } from '@/services/instagram';
import { useCastContainerVoteMutation, useRecordContainerViewMutation } from '@/services/useInstagram';
import { timeAgo } from '@/utils/timeAgo';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface ContainerCardProps {
  container: MemeContainerResponse;
}

// Pins the in-app WebView to Instagram only — without this, any redirect chain from the
// loaded page (an ad, a compromised/renamed account, a malicious short-link) could
// navigate the WebView to an arbitrary origin inside the app, a credible phishing surface
// (SecurityIssues.md L-4). Backend already anchors the *initial* URL the same way
// (services/instagram.py::_validate_instagram_url); this constrains everything the page
// can navigate to *after* it loads.
const INSTAGRAM_WEBVIEW_ORIGIN_WHITELIST = ['https://www.instagram.com/*', 'https://instagram.com/*'];
const INSTAGRAM_HOST_RE = /^https:\/\/(www\.)?instagram\.com(\/|$)/i;

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
    <View ref={cardRef} className="mb-3 border-b border-outline-variant/30 bg-bg pb-3">
      <View className="flex-row items-center px-4 py-3">
        <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <MaterialIcons name="camera-alt" size={16} color="#ffffff" />
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <View>
            <Text className="font-title text-sm text-heading">{container.submitter.username}</Text>
            <Text className="font-body text-xs text-ink-muted">shared from Instagram</Text>
          </View>
          <Text className="font-body text-xs text-ink-muted">{timeAgo(container.created_at)}</Text>
        </View>
      </View>

      <View style={{ width: '100%', aspectRatio: 4 / 5 }} className="bg-black">
        {container.metadata_status === 'pending' ? (
          <View className="flex-1 items-center justify-center bg-surface-high">
            <ActivityIndicator color="#e3bdc5" />
            <Text className="mt-2 font-body text-xs text-ink-muted">Fetching preview…</Text>
          </View>
        ) : (
          <>
            <WebView
              source={{ uri: container.source_url }}
              style={{ flex: 1 }}
              startInLoadingState
              originWhitelist={INSTAGRAM_WEBVIEW_ORIGIN_WHITELIST}
              onShouldStartLoadWithRequest={(request) => INSTAGRAM_HOST_RE.test(request.url)}
              renderLoading={() => (
                <View className="flex-1 items-center justify-center bg-black">
                  <ActivityIndicator color="#e3bdc5" />
                </View>
              )}
            />
            <View className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5">
              <MaterialIcons name="camera-alt" size={16} color="#ffffff" />
            </View>
          </>
        )}
      </View>

      <View className="flex-row items-center justify-between px-4 pt-3">
        <VotePill
          score={container.score}
          viewerVote={container.viewer_vote}
          isVoting={isVoting}
          onUpvote={() => onVote(1)}
          onDownvote={() => onVote(-1)}
        />

        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open original post on Instagram"
            onPress={() => WebBrowser.openBrowserAsync(container.source_url)}
            className="h-11 flex-row items-center gap-1 rounded-full border border-outline-variant px-3">
            <Text className="font-title text-xs text-heading">Open Original ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle comments"
            onPress={() => setCommentsOpen((open) => !open)}
            className="h-11 flex-row items-center gap-1">
            <MaterialIcons name="chat-bubble-outline" size={20} color="#e3bdc5" />
            <Text className="font-body text-sm text-ink-muted">{container.comment_count}</Text>
          </Pressable>
        </View>
      </View>

      {container.title ? (
        <Text className="px-4 pt-2 font-body text-sm text-ink">{container.title}</Text>
      ) : null}

      {container.view_count !== null ? (
        // Visible only to the submitter — server-gated, see services/instagram.py.
        <Text className="px-4 pt-1 font-body text-xs text-ink-muted">
          👁 {container.view_count} view{container.view_count === 1 ? '' : 's'}
        </Text>
      ) : null}

      {castVote.isError ? (
        <Text className="px-4 pt-1 font-body text-xs text-error">{castVote.error?.message}</Text>
      ) : null}

      {commentsOpen ? <ContainerCommentsSection containerId={container.id} /> : null}
    </View>
  );
}
