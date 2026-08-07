import { describe, expect, it } from '@jest/globals';
import type { InfiniteData } from '@tanstack/react-query';

import type { NotificationPageResponse, NotificationResponse } from '@/services/notifications';
import {
  insertNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationsCache';

function makeNotification(
  id: string,
  overrides: Partial<NotificationResponse> = {}
): NotificationResponse {
  return {
    id,
    type: 'challenge_starting',
    title: `Notification ${id}`,
    body: 'body',
    data: {},
    read_at: null,
    created_at: '2026-08-06T10:00:00.000Z',
    ...overrides,
  };
}

function makeCache(pages: NotificationResponse[][]): InfiniteData<NotificationPageResponse> {
  return {
    pages: pages.map((items, index) => ({
      items,
      next_cursor: index < pages.length - 1 ? `cursor-${index}` : null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
  };
}

describe('insertNotification', () => {
  it('creates a fresh cache when empty', () => {
    const result = insertNotification(undefined, makeNotification('n1'));
    expect(result?.pages[0].items).toEqual([makeNotification('n1')]);
  });

  it('prepends into the first page', () => {
    const cache = makeCache([[makeNotification('n1')]]);
    const result = insertNotification(cache, makeNotification('n2'));
    expect(result?.pages[0].items.map((i) => i.id)).toEqual(['n2', 'n1']);
  });

  it('is a no-op for a duplicate id', () => {
    const cache = makeCache([[makeNotification('n1')]]);
    const result = insertNotification(cache, makeNotification('n1'));
    expect(result).toBe(cache);
  });

  it('preserves later pages by reference', () => {
    const cache = makeCache([[makeNotification('n1')], [makeNotification('n2')]]);
    const result = insertNotification(cache, makeNotification('n3'));
    expect(result?.pages[1]).toBe(cache.pages[1]);
  });
});

describe('markNotificationRead', () => {
  it('stamps read_at on the matching item only', () => {
    const cache = makeCache([[makeNotification('n1'), makeNotification('n2')]]);
    const result = markNotificationRead(cache, 'n1', '2026-08-06T11:00:00.000Z');
    expect(result?.pages[0].items[0].read_at).toBe('2026-08-06T11:00:00.000Z');
    expect(result?.pages[0].items[1].read_at).toBeNull();
  });

  it('is a no-op when the notification is already read', () => {
    const cache = makeCache([[makeNotification('n1', { read_at: '2026-08-06T09:00:00.000Z' })]]);
    const result = markNotificationRead(cache, 'n1', '2026-08-06T11:00:00.000Z');
    expect(result).toBe(cache);
  });

  it('is a no-op for an unknown id', () => {
    const cache = makeCache([[makeNotification('n1')]]);
    const result = markNotificationRead(cache, 'missing', '2026-08-06T11:00:00.000Z');
    expect(result).toBe(cache);
  });
});

describe('markAllNotificationsRead', () => {
  it('stamps every unread item across all pages', () => {
    const cache = makeCache([
      [makeNotification('n1'), makeNotification('n2', { read_at: '2026-08-06T09:00:00.000Z' })],
      [makeNotification('n3')],
    ]);
    const result = markAllNotificationsRead(cache, '2026-08-06T11:00:00.000Z');
    expect(result?.pages[0].items[0].read_at).toBe('2026-08-06T11:00:00.000Z');
    expect(result?.pages[0].items[1].read_at).toBe('2026-08-06T09:00:00.000Z');
    expect(result?.pages[1].items[0].read_at).toBe('2026-08-06T11:00:00.000Z');
  });

  it('is a no-op when everything is already read', () => {
    const cache = makeCache([[makeNotification('n1', { read_at: '2026-08-06T09:00:00.000Z' })]]);
    const result = markAllNotificationsRead(cache, '2026-08-06T11:00:00.000Z');
    expect(result).toBe(cache);
  });
});
