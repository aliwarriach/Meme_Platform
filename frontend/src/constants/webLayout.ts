/**
 * Desktop/web-only layout constants. Nothing here is read on native — the app is mobile-first
 * and native screens always render full-bleed regardless of these values.
 */

/** Below this window width, the web build renders full-bleed just like native (narrow browser window, tablet). */
export const DESKTOP_FRAME_MIN_WIDTH = 900;

/** Fixed width of the persistent left sidebar nav shown on desktop web. */
export const DESKTOP_SIDEBAR_WIDTH = 264;

/** Max width of the centered content column next to the sidebar on desktop web. */
export const DESKTOP_CONTENT_MAX_WIDTH = 680;

/** Wider content column used on the Feed route only, to leave room for the open inbox side panel. */
export const DESKTOP_FEED_CONTENT_MAX_WIDTH = 1040;

/** Fixed width of the always-open inbox panel on the Feed screen's right rail (desktop web only). */
export const DESKTOP_INBOX_PANEL_WIDTH = 380;

/** Max width for centered dialog-style modals on desktop web (Modal portals outside the app shell). */
export const DESKTOP_MODAL_MAX_WIDTH = 480;
