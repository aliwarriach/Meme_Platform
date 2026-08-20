import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import WebVotePill from '@/components/web/WebVotePill';
import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { ContainerCommentsSection } from '@/features/instagram-companion/ContainerCommentsSection';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import type { MemeContainerResponse } from '@/services/instagram';
import { useCastContainerVoteMutation, useRecordContainerViewMutation } from '@/services/useInstagram';
import { timeAgo } from '@/utils/timeAgo';
import { useRecordViewOnVisible } from '@/utils/useRecordViewOnVisible';

interface WebContainerCardProps {
  container: MemeContainerResponse;
}

// See features/instagram-companion/ContainerCard.tsx (native) for why this whitelist
// exists — same fix, same rationale (SecurityIssues.md L-4).
const INSTAGRAM_WEBVIEW_ORIGIN_WHITELIST = ['https://www.instagram.com/*', 'https://instagram.com/*'];
const INSTAGRAM_HOST_RE = /^https:\/\/(www\.)?instagram\.com(\/|$)/i;

/** "Dark Cinema" equivalent of `features/instagram-companion/ContainerCard.tsx` (native-resolved,
 * untouched) for Instagram Companion Mode items merged into the web feed. Same data/hooks,
 * new chrome only. */
export function WebContainerCard({ container }: WebContainerCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const castVote = useCastContainerVoteMutation();
  const recordView = useRecordContainerViewMutation();
  const cardRef = useRecordViewOnVisible(() => recordView.mutate(container.id));
  const { colors: FEED_WEB_COLORS, type: FEED_WEB_TYPE, radius: FEED_WEB_RADIUS, spacing: FEED_WEB_SPACING } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING), [FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING]);

  const isVoting = castVote.isPending;

  const onVote = (value: 1 | -1) => castVote.mutate({ containerId: container.id, value });

  return (
    <View ref={cardRef} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <MaterialIcons name="camera-alt" size={15} color={FEED_WEB_COLORS.onAccent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[FEED_WEB_TYPE.title, styles.heading]}>{container.submitter.username}</Text>
          <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>shared from Instagram</Text>
        </View>
        <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>{timeAgo(container.created_at)}</Text>
      </View>

      <View style={styles.mediaWrap}>
        {container.metadata_status === 'pending' ? (
          <View style={styles.mediaCenter}>
            <ActivityIndicator color={FEED_WEB_COLORS.foregroundMuted} />
            <Text style={[FEED_WEB_TYPE.meta, styles.muted, styles.mediaCenterLabel]}>Fetching preview…</Text>
          </View>
        ) : (
          <>
            <WebView
              source={{ uri: container.source_url }}
              style={styles.media}
              startInLoadingState
              originWhitelist={INSTAGRAM_WEBVIEW_ORIGIN_WHITELIST}
              onShouldStartLoadWithRequest={(request) => INSTAGRAM_HOST_RE.test(request.url)}
              renderLoading={() => (
                <View style={styles.mediaCenter}>
                  <ActivityIndicator color={FEED_WEB_COLORS.foregroundMuted} />
                </View>
              )}
            />
            <View style={styles.mediaCornerBadge}>
              <MaterialIcons name="camera-alt" size={15} color={FEED_WEB_COLORS.onAccent} />
            </View>
          </>
        )}
      </View>

      <View style={styles.actionsRow}>
        <WebVotePill
          score={container.score}
          viewerVote={container.viewer_vote}
          isVoting={isVoting}
          onUpvote={() => onVote(1)}
          onDownvote={() => onVote(-1)}
        />

        <View style={styles.actionsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open original post on Instagram"
            onPress={() => WebBrowser.openBrowserAsync(container.source_url)}
            style={({ hovered }) => [styles.openOriginal, hovered && styles.openOriginalHovered]}>
            <Text style={[FEED_WEB_TYPE.meta, styles.heading]}>Open Original ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle comments"
            onPress={() => setCommentsOpen((open) => !open)}
            style={({ hovered }) => [styles.iconButton, hovered && styles.iconButtonHovered]}>
            <MaterialIcons name="chat-bubble-outline" size={18} color={FEED_WEB_COLORS.foregroundMuted} />
            <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>{container.comment_count}</Text>
          </Pressable>
        </View>
      </View>

      {container.title ? <Text style={[FEED_WEB_TYPE.body, styles.caption]}>{container.title}</Text> : null}

      {container.view_count !== null ? (
        <View style={styles.viewCountRow}>
          <MaterialIcons name="visibility" size={14} color={FEED_WEB_COLORS.foregroundMuted} />
          <Text style={[FEED_WEB_TYPE.meta, styles.muted]}>
            {container.view_count} view{container.view_count === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}

      {castVote.isError ? (
        <Text style={[FEED_WEB_TYPE.meta, styles.errorText]}>{castVote.error?.message}</Text>
      ) : null}

      {commentsOpen ? (
        <View style={styles.commentsWrap}>
          <ContainerCommentsSection containerId={container.id} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (
  FEED_WEB_COLORS: VaporwaveTheme['colors'],
  FEED_WEB_RADIUS: VaporwaveTheme['radius'],
  FEED_WEB_SPACING: VaporwaveTheme['spacing'],
) => StyleSheet.create({
  card: {
    marginBottom: FEED_WEB_SPACING.lg,
    borderRadius: FEED_WEB_RADIUS.card,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.border,
    backgroundColor: FEED_WEB_COLORS.surfaceGlass,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.md,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingVertical: FEED_WEB_SPACING.md,
  },
  badge: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FEED_WEB_COLORS.indigoSecondary,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    color: FEED_WEB_COLORS.foreground,
  },
  muted: {
    color: FEED_WEB_COLORS.foregroundMuted,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: FEED_WEB_COLORS.gradientBottom,
  },
  media: {
    flex: 1,
  },
  mediaCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCenterLabel: {
    marginTop: FEED_WEB_SPACING.sm,
  },
  mediaCornerBadge: {
    position: 'absolute',
    right: FEED_WEB_SPACING.md,
    top: FEED_WEB_SPACING.md,
    borderRadius: FEED_WEB_RADIUS.pill,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.md,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FEED_WEB_SPACING.sm,
  },
  openOriginal: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: FEED_WEB_SPACING.md,
    borderRadius: FEED_WEB_RADIUS.pill,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.border,
  },
  openOriginalHovered: {
    backgroundColor: FEED_WEB_COLORS.hoverTint,
  },
  iconButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: FEED_WEB_SPACING.sm,
    gap: 4,
    borderRadius: FEED_WEB_RADIUS.pill,
  },
  iconButtonHovered: {
    backgroundColor: FEED_WEB_COLORS.hoverTint,
  },
  caption: {
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.sm,
    color: FEED_WEB_COLORS.foreground,
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.xs,
    paddingBottom: FEED_WEB_SPACING.sm,
  },
  errorText: {
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.xs,
    color: FEED_WEB_COLORS.error,
  },
  commentsWrap: {
    marginTop: FEED_WEB_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: FEED_WEB_COLORS.border,
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingTop: FEED_WEB_SPACING.md,
    paddingBottom: FEED_WEB_SPACING.sm,
  },
});
