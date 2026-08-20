import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import DesktopSidebarNav from '@/components/web/DesktopSidebarNav';
import {
  DESKTOP_CONTENT_MAX_WIDTH,
  DESKTOP_FEED_CONTENT_MAX_WIDTH,
  DESKTOP_FRAME_MIN_WIDTH,
} from '@/constants/webLayout';
import { useWebThemeMode } from '@/constants/WebThemeMode';

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
 *
 * Reads the same app-wide `useWebThemeMode()` every screen does (this component is mounted
 * inside `WebThemeModeProvider` in `app/_layout.tsx`) — the canvas and the sidebar-divider
 * repaint with the rest of the app instead of staying dark-only regardless of the current mode.
 */
export default function DesktopShell({ children }: DesktopShellProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { mode } = useWebThemeMode();

  if (Platform.OS !== 'web' || width < DESKTOP_FRAME_MIN_WIDTH) {
    return <>{children}</>;
  }

  const contentMaxWidth = pathname === '/feed' ? DESKTOP_FEED_CONTENT_MAX_WIDTH : DESKTOP_CONTENT_MAX_WIDTH;

  return (
    <View style={[styles.root, { backgroundColor: mode === 'dark' ? '#0E060F' : '#FFFFFF' }]}>
      <DesktopSidebarNav />
      <View style={styles.contentArea}>
        <View
          style={[
            styles.content,
            { maxWidth: contentMaxWidth, borderLeftColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.09)' : '#F3D9E7' },
          ]}>
          {children}
        </View>
      </View>
    </View>
  );
}

// Neon Plum shell tokens (A1/A2 in the palette spec) — Group A colors are inlined above (mode
// picked at render time) since this component is web-only and never rendered on native, so it's
// safe to diverge from MASTER.md's native `#1e0f13`/`#372529` shell without touching the mobile
// app.
const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    borderLeftWidth: 1,
  },
});
