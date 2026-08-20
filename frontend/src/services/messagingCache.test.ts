import { describe, expect, it } from '@jest/globals';
import type { InfiniteData } from '@tanstack/react-query';

import type { PublicUserResponse } from '@/services/auth';
import type {
  ConversationResponse,
  MessagePageResponse,
  MessageResponse,
} from '@/services/messaging';
import {
  applyMessageToConversations,
  clearUnread,
  findMessage,
  insertMessage,
  markOwnMessagesRead,
  removeMessage,
  replaceMessage,
  totalUnread,
} from '@/services/messagingCache';

const alice: PublicUserResponse = {
  id: 'user-1',
  username: 'alice',
  bio: null,
  avatar_url: null,
};

const bob: PublicUserResponse = { ...alice, id: 'user-2', username: 'bob' };

function makeMessage(id: string, overrides: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id,
    conversation_id: 'conv-1',
    sender: alice,
    kind: 'text',
    body: id,
    meme: null,
    read_at: null,
    created_at: '2026-08-06T10:00:00.000Z',
    ...overrides,
  };
}

function makeCache(pages: MessageResponse[][]): InfiniteData<MessagePageResponse> {
  return {
    pages: pages.map((items, index) => ({
      items,
      next_cursor: index < pages.length - 1 ? `cursor-${index}` : null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
  };
}

function makeConversation(
  id: string,
  overrides: Partial<ConversationResponse> = {}
): ConversationResponse {
  return {
    id,
    other_user: bob,
    last_message: null,
    unread_count: 0,
    last_message_at: null,
    ...overrides,
  };
}

describe('insertMessage', () => {
  it('seeds a page when the thread has never been loaded', () => {
    const result = insertMessage(undefined, makeMessage('m1'));
    expect(result?.pages).toHaveLength(1);
    expect(result?.pages[0].items.map((m) => m.id)).toEqual(['m1']);
  });

  it('puts a newer message at the front of the newest-first page', () => {
    const cache = makeCache([[makeMessage('m1', { created_at: '2026-08-06T10:00:00.000Z' })]]);
    const result = insertMessage(cache, makeMessage('m2', { created_at: '2026-08-06T10:05:00.000Z' }));
    expect(result?.pages[0].items.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('orders by timestamp rather than arrival, so a late frame lands in the right place', () => {
    const cache = makeCache([
      [
        makeMessage('m3', { created_at: '2026-08-06T10:10:00.000Z' }),
        makeMessage('m1', { created_at: '2026-08-06T10:00:00.000Z' }),
      ],
    ]);
    const result = insertMessage(cache, makeMessage('m2', { created_at: '2026-08-06T10:05:00.000Z' }));
    expect(result?.pages[0].items.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
  });

  it('does not duplicate a message the socket echoes back after the POST resolved', () => {
    const cache = makeCache([[makeMessage('m1')]]);
    const result = insertMessage(cache, makeMessage('m1', { body: 'updated' }));
    expect(result?.pages[0].items).toHaveLength(1);
    expect(result?.pages[0].items[0].body).toBe('updated');
  });

  it('leaves older pages untouched by reference', () => {
    const cache = makeCache([[makeMessage('m2')], [makeMessage('m1')]]);
    const result = insertMessage(cache, makeMessage('m3', { created_at: '2026-08-06T11:00:00.000Z' }));
    expect(result?.pages[1]).toBe(cache.pages[1]);
  });
});

describe('replaceMessage / removeMessage', () => {
  it('swaps the pending placeholder for the server row', () => {
    const cache = makeCache([[makeMessage('pending-1')]]);
    const result = replaceMessage(cache, 'pending-1', makeMessage('m1'));
    expect(result?.pages[0].items.map((m) => m.id)).toEqual(['m1']);
  });

  it('drops only the failed placeholder, keeping messages that arrived meanwhile', () => {
    const cache = makeCache([[makeMessage('incoming'), makeMessage('pending-1')]]);
    const result = removeMessage(cache, 'pending-1');
    expect(result?.pages[0].items.map((m) => m.id)).toEqual(['incoming']);
  });

  it('returns the same cache when the id is not present', () => {
    const cache = makeCache([[makeMessage('m1')]]);
    expect(removeMessage(cache, 'nope')).toBe(cache);
    expect(replaceMessage(cache, 'nope', makeMessage('m9'))).toBe(cache);
  });
});

describe('markOwnMessagesRead', () => {
  it('stamps read_at on the viewer own messages only', () => {
    const cache = makeCache([
      [makeMessage('mine', { sender: alice }), makeMessage('theirs', { sender: bob })],
    ]);
    const result = markOwnMessagesRead(cache, alice.id, '2026-08-06T12:00:00.000Z');
    expect(findMessage(result, 'mine')?.read_at).toBe('2026-08-06T12:00:00.000Z');
    expect(findMessage(result, 'theirs')?.read_at).toBeNull();
  });

  it('is a no-op once everything is already read', () => {
    const cache = makeCache([[makeMessage('mine', { read_at: '2026-08-06T12:00:00.000Z' })]]);
    expect(markOwnMessagesRead(cache, alice.id, '2026-08-06T13:00:00.000Z')).toBe(cache);
  });
});

describe('applyMessageToConversations', () => {
  it('moves the touched conversation to the front and updates the preview', () => {
    const conversations = [makeConversation('conv-2'), makeConversation('conv-1')];
    const message = makeMessage('m1', { created_at: '2026-08-06T10:00:00.000Z' });

    const result = applyMessageToConversations(conversations, message, { incrementUnread: true });

    expect(result?.map((c) => c.id)).toEqual(['conv-1', 'conv-2']);
    expect(result?.[0].last_message?.id).toBe('m1');
    expect(result?.[0].last_message_at).toBe('2026-08-06T10:00:00.000Z');
    expect(result?.[0].unread_count).toBe(1);
  });

  it('does not bump unread for the viewer own send', () => {
    const conversations = [makeConversation('conv-1', { unread_count: 2 })];
    const result = applyMessageToConversations(conversations, makeMessage('m1'), {
      incrementUnread: false,
    });
    expect(result?.[0].unread_count).toBe(2);
  });

  it('signals an unknown conversation by returning the list unchanged', () => {
    const conversations = [makeConversation('conv-9')];
    const result = applyMessageToConversations(conversations, makeMessage('m1'), {
      incrementUnread: true,
    });
    expect(result).toBe(conversations);
  });
});

describe('clearUnread / totalUnread', () => {
  it('zeroes one conversation badge', () => {
    const conversations = [
      makeConversation('conv-1', { unread_count: 3 }),
      makeConversation('conv-2', { unread_count: 1 }),
    ];
    const result = clearUnread(conversations, 'conv-1');
    expect(result?.map((c) => c.unread_count)).toEqual([0, 1]);
  });

  it('is a no-op when there is nothing unread', () => {
    const conversations = [makeConversation('conv-1')];
    expect(clearUnread(conversations, 'conv-1')).toBe(conversations);
  });

  it('sums badges for the global count', () => {
    expect(
      totalUnread([
        makeConversation('conv-1', { unread_count: 3 }),
        makeConversation('conv-2', { unread_count: 4 }),
      ])
    ).toBe(7);
    expect(totalUnread(undefined)).toBe(0);
  });
});
