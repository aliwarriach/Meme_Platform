import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import DesktopSidebarNav from '@/components/web/DesktopSidebarNav';
import {
  DESKTOP_CONTENT_MAX_WIDTH,
  DESKTOP_FEED_CONTENT_MAX_WIDTH,
  DESKTOP_FRAME_MIN_WIDTH,
} from '@/constants/webLayout';

interface DesktopShellProps {
  children: ReactNode;
}

/**
 * Desktop web app shell: persistent left sidebar nav + a content column, the same chrome
 * pattern as Instagram/Twitter desktop — not a phone mockup floating on a backdrop. No-op on
 * native and on narrow web viewports (mobile browser, half-snapped window) — those render
 * `children` directly, byte-for-byte the same tree as before this component existed.
 *
 * The Feed route gets a wider column than every other screen, to leave room for its open
 * inbox side panel (`DesktopInboxPanel`, mounted by `FeedScreen` itself, not here).
 */
export default function DesktopShell({ children }: DesktopShellProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  if (Platform.OS !== 'web' || width < DESKTOP_FRAME_MIN_WIDTH) {
    return <>{children}</>;
  }

  const contentMaxWidth = pathname === '/feed' ? DESKTOP_FEED_CONTENT_MAX_WIDTH : DESKTOP_CONTENT_MAX_WIDTH;

  return (
    <View style={styles.root}>
      <DesktopSidebarNav />
      <View style={styles.contentArea}>
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1e0f13',
  },
  contentArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#372529',
  },
});
