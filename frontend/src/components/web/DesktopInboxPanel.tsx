import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { DESKTOP_INBOX_PANEL_WIDTH } from '@/constants/webLayout';
import { InboxList, STATUS_DOT_COLOR } from '@/features/meme-sending/InboxList';
import type { RootState } from '@/store/store';

/**
 * Desktop-web-only right rail on the Feed screen: the inbox, already open, next to the feed
 * (Instagram-DMs-style) — mounted directly by `FeedScreen`, not global `DesktopShell` chrome,
 * since an always-open inbox only makes sense next to the feed, not next to the creator/forms.
 */
export default function DesktopInboxPanel() {
  const socketStatus = useSelector((state: RootState) => state.socket.status);

  return (
    <View style={[styles.root, { width: DESKTOP_INBOX_PANEL_WIDTH }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: STATUS_DOT_COLOR[socketStatus] ?? STATUS_DOT_COLOR.disconnected },
            ]}
          />
          <Text style={styles.statusText}>{socketStatus}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <InboxList />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#372529',
    backgroundColor: '#1e0f13',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#372529',
  },
  title: {
    fontFamily: 'BeVietnamPro_700Bold',
    fontSize: 18,
    color: '#ffffff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 12,
    color: '#e3bdc5',
  },
  body: {
    flex: 1,
  },
});
