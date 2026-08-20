import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import type { VaporwaveTheme } from '@/constants/webFeedThemeVapor';
import { DESKTOP_INBOX_PANEL_WIDTH } from '@/constants/webLayout';
import { useVaporwaveTheme } from '@/constants/VaporwaveWebTheme';
import { ConversationList, STATUS_DOT_COLOR } from '@/features/messaging/ConversationList';
import type { RootState } from '@/store/store';

/**
 * Desktop-web-only right rail for the "Dark Cinema" feed pilot — same always-open-inbox
 * slot/behavior as `components/web/DesktopInboxPanel.tsx` (that file is untouched; it's still
 * imported by the native-resolved `FeedScreen.tsx`, so it's out of bounds for this pass), just
 * new chrome + reusing `ConversationList` as the actual data-bearing component.
 *
 * Concept-generation note: a "trending/discovery" block was considered for this rail too, but
 * cut — it would need new data plumbing (out of scope: "backend/services/store are out of
 * scope, UI layer only") and would compete with the inbox for attention without a clear win
 * over the primary action (scrolling + engaging with the feed itself).
 */
export default function WebFeedRail() {
  const socketStatus = useSelector((state: RootState) => state.socket.status);
  const dotColor = STATUS_DOT_COLOR[socketStatus] ?? STATUS_DOT_COLOR.disconnected;
  const { colors: FEED_WEB_COLORS, type: FEED_WEB_TYPE, radius: FEED_WEB_RADIUS, spacing: FEED_WEB_SPACING } = useVaporwaveTheme();
  const styles = useMemo(() => createStyles(FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING), [FEED_WEB_COLORS, FEED_WEB_RADIUS, FEED_WEB_SPACING]);

  return (
    <View style={[styles.root, { width: DESKTOP_INBOX_PANEL_WIDTH }]}>
      <View style={styles.header}>
        <Text style={[FEED_WEB_TYPE.h2, styles.title]}>Inbox</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[FEED_WEB_TYPE.meta, styles.statusText]}>{socketStatus}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <ConversationList />
      </View>
    </View>
  );
}

const createStyles = (
  FEED_WEB_COLORS: VaporwaveTheme['colors'],
  FEED_WEB_RADIUS: VaporwaveTheme['radius'],
  FEED_WEB_SPACING: VaporwaveTheme['spacing'],
) => StyleSheet.create({
  root: {
    height: '100%',
    borderRadius: FEED_WEB_RADIUS.card,
    borderWidth: 1,
    borderColor: FEED_WEB_COLORS.border,
    backgroundColor: FEED_WEB_COLORS.surfaceGlass,
    marginVertical: FEED_WEB_SPACING.lg,
    marginRight: FEED_WEB_SPACING.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FEED_WEB_SPACING.lg,
    paddingVertical: FEED_WEB_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: FEED_WEB_COLORS.border,
  },
  title: {
    color: FEED_WEB_COLORS.foreground,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  statusText: {
    color: FEED_WEB_COLORS.foregroundMuted,
  },
  body: {
    flex: 1,
  },
});
