import type { InfiniteData } from '@tanstack/react-query';

import type { ConversationResponse, MessagePageResponse, MessageResponse } from '@/services/messaging';

/**
 * Pure cache transforms for the messaging surfaces, kept out of the hooks so they can be
 * tested without a React tree.
 *
 * Same principle as `optimisticCache.ts`: a new message patches what's already cached
 * rather than invalidating it. Invalidating a thread would refetch the whole loaded
 * history and jump the scroll position mid-conversation, and invalidating the
 * conversation list would make it flicker every time a socket frame arrives.
 *
 * Transforms are identity-preserving — an unchanged node comes back by reference, so only
 * the affected list re-renders.
 */

export type ThreadCache = InfiniteData<MessagePageResponse> | undefined;

/** Newest-first ordering, matching the backend's keyset page. */
function isNewer(a: MessageResponse, b: MessageResponse): boolean {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at;
  return a.id > b.id;
}

/**
 * Inserts into page 0 by timestamp rather than blindly unshifting: an optimistic message
 * and a socket frame for the *other* side's message can arrive in either order, and a
 * pending message carries a client timestamp that may sit slightly behind a server one.
 */
export function insertMessage(cache: ThreadCache, message: MessageResponse): ThreadCache {
  if (!cache || cache.pages.length === 0) {
    return {
      pages: [{ items: [message], next_cursor: null }],
      pageParams: [null],
    } as InfiniteData<MessagePageResponse>;
  }

  if (findMessage(cache, message.id)) return replaceMessage(cache, message.id, message);

  const [first, ...rest] = cache.pages;
  const index = first.items.findIndex((item) => isNewer(message, item));
  const items =
    index === -1
      ? [...first.items, message]
      : [...first.items.slice(0, index), message, ...first.items.slice(index)];

  return { ...cache, pages: [{ ...first, items }, ...rest] };
}

export function findMessage(cache: ThreadCache, messageId: string): MessageResponse | undefined {
  return cache?.pages.flatMap((page) => page.items).find((item) => item.id === messageId);
}

export function replaceMessage(
  cache: ThreadCache,
  messageId: string,
  replacement: MessageResponse
): ThreadCache {
  if (!cache) return cache;
  let changed = false;
  const pages = cache.pages.map((page) => {
    if (!page.items.some((item) => item.id === messageId)) return page;
    changed = true;
    return { ...page, items: page.items.map((item) => (item.id === messageId ? replacement : item)) };
  });
  return changed ? { ...cache, pages } : cache;
}

export function removeMessage(cache: ThreadCache, messageId: string): ThreadCache {
  if (!cache) return cache;
  let changed = false;
  const pages = cache.pages.map((page) => {
    if (!page.items.some((item) => item.id === messageId)) return page;
    changed = true;
    return { ...page, items: page.items.filter((item) => item.id !== messageId) };
  });
  return changed ? { ...cache, pages } : cache;
}

/** Stamps `read_at` on every message the viewer sent — what a `message_read` frame means. */
export function markOwnMessagesRead(
  cache: ThreadCache,
  viewerId: string,
  readAt: string
): ThreadCache {
  if (!cache) return cache;
  let changed = false;
  const pages = cache.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (item.sender.id !== viewerId || item.read_at !== null) return item;
      pageChanged = true;
      return { ...item, read_at: readAt };
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...cache, pages } : cache;
}

/**
 * Moves the touched conversation to the front — the list is ordered by `last_message_at`,
 * so a new message has to reorder it the same way a refetch would.
 */
export function applyMessageToConversations(
  conversations: ConversationResponse[] | undefined,
  message: MessageResponse,
  options: { incrementUnread: boolean }
): ConversationResponse[] | undefined {
  if (!conversations) return conversations;

  const index = conversations.findIndex((c) => c.id === message.conversation_id);
  if (index === -1) return conversations;

  const current = conversations[index];
  const updated: ConversationResponse = {
    ...current,
    last_message: message,
    last_message_at: message.created_at,
    unread_count: options.incrementUnread ? current.unread_count + 1 : current.unread_count,
  };

  return [updated, ...conversations.slice(0, index), ...conversations.slice(index + 1)];
}

export function clearUnread(
  conversations: ConversationResponse[] | undefined,
  conversationId: string
): ConversationResponse[] | undefined {
  if (!conversations) return conversations;
  let changed = false;
  const next = conversations.map((c) => {
    if (c.id !== conversationId || c.unread_count === 0) return c;
    changed = true;
    return { ...c, unread_count: 0 };
  });
  return changed ? next : conversations;
}

export function totalUnread(conversations: ConversationResponse[] | undefined): number {
  return (conversations ?? []).reduce((sum, c) => sum + c.unread_count, 0);
}
