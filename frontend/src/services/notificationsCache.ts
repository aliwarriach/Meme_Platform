import type { InfiniteData } from '@tanstack/react-query';

import type { NotificationPageResponse, NotificationResponse } from '@/services/notifications';

/**
 * Pure cache transforms for the notification centre, kept out of the hooks so they can be
 * tested without a React tree — same principle as `messagingCache.ts`/`optimisticCache.ts`:
 * a live socket frame or a mark-read action patches what's already cached rather than
 * invalidating it, so the list never jumps or reshuffles under the user.
 */

export type NotificationsCache = InfiniteData<NotificationPageResponse> | undefined;

/** Prepends into page 0 — the list is newest-first, matching the backend's keyset page. */
export function insertNotification(
  cache: NotificationsCache,
  notification: NotificationResponse
): NotificationsCache {
  if (!cache || cache.pages.length === 0) {
    return {
      pages: [{ items: [notification], next_cursor: null }],
      pageParams: [null],
    } as InfiniteData<NotificationPageResponse>;
  }

  if (cache.pages.some((page) => page.items.some((item) => item.id === notification.id))) {
    return cache;
  }

  const [first, ...rest] = cache.pages;
  return { ...cache, pages: [{ ...first, items: [notification, ...first.items] }, ...rest] };
}

export function markNotificationRead(
  cache: NotificationsCache,
  notificationId: string,
  readAt: string
): NotificationsCache {
  if (!cache) return cache;
  let changed = false;
  const pages = cache.pages.map((page) => {
    if (!page.items.some((item) => item.id === notificationId && item.read_at === null)) {
      return page;
    }
    changed = true;
    return {
      ...page,
      items: page.items.map((item) =>
        item.id === notificationId ? { ...item, read_at: readAt } : item
      ),
    };
  });
  return changed ? { ...cache, pages } : cache;
}

export function markAllNotificationsRead(
  cache: NotificationsCache,
  readAt: string
): NotificationsCache {
  if (!cache) return cache;
  let changed = false;
  const pages = cache.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (item.read_at !== null) return item;
      pageChanged = true;
      return { ...item, read_at: readAt };
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...cache, pages } : cache;
}
