import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import type { PublicUserResponse } from '@/services/auth';
import type { MemeContainerResponse } from '@/services/instagram';
import type { MemeResponse, MergedFeedPageResponse } from '@/services/memes';
import {
  applyVoteLocally,
  bumpCommentCount,
  markScoreSurfacesStale,
  patchContainerInCaches,
  patchMemeInCaches,
  restoreContentCaches,
  snapshotContentCaches,
} from '@/services/optimisticCache';

const author: PublicUserResponse = {
  id: 'user-1',
  username: 'alice',
  bio: null,
  avatar_url: null,
};

function makeMeme(id: string, overrides: Partial<MemeResponse> = {}): MemeResponse {
  return {
    id,
    author,
    image_url: `https://example.test/${id}.png`,
    caption: null,
    audiences: ['public'],
    community: null,
    upvote_count: 0,
    downvote_count: 0,
    score: 0,
    comment_count: 0,
    view_count: null,
    viewer_vote: null,
    created_at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

function makeContainer(
  id: string,
  overrides: Partial<MemeContainerResponse> = {}
): MemeContainerResponse {
  return {
    id,
    submitter: author,
    platform: 'instagram',
    source_url: `https://instagram.com/reel/${id}`,
    title: null,
    thumbnail_url: null,
    metadata_status: 'ready',
    upvote_count: 0,
    downvote_count: 0,
    score: 0,
    comment_count: 0,
    view_count: null,
    viewer_vote: null,
    created_at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

const mergedPage = (items: MergedFeedPageResponse['items']): MergedFeedPageResponse => ({
  items,
  has_more: false,
});

const clients: QueryClient[] = [];

/** Tracked so afterEach can clear the gc timers that would otherwise keep jest alive. */
function makeClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(client);
  return client;
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe('applyVoteLocally', () => {
  it('adds an upvote when the viewer has not voted', () => {
    const result = applyVoteLocally(makeMeme('m1'), 1);

    expect(result).toMatchObject({ upvote_count: 1, downvote_count: 0, score: 1, viewer_vote: 1 });
  });

  it('adds a downvote when the viewer has not voted', () => {
    const result = applyVoteLocally(makeMeme('m1'), -1);

    expect(result).toMatchObject({ upvote_count: 0, downvote_count: 1, score: -1, viewer_vote: -1 });
  });

  it('removes the vote when the same value is re-cast', () => {
    const voted = makeMeme('m1', { upvote_count: 3, score: 3, viewer_vote: 1 });

    expect(applyVoteLocally(voted, 1)).toMatchObject({
      upvote_count: 2,
      score: 2,
      viewer_vote: null,
    });
  });

  it('flips by two when the opposite value is cast', () => {
    const voted = makeMeme('m1', { upvote_count: 5, downvote_count: 1, score: 4, viewer_vote: 1 });

    expect(applyVoteLocally(voted, -1)).toMatchObject({
      upvote_count: 4,
      downvote_count: 2,
      score: 2,
      viewer_vote: -1,
    });
  });

  it('flips a downvote to an upvote', () => {
    const voted = makeMeme('m1', { upvote_count: 2, downvote_count: 3, score: -1, viewer_vote: -1 });

    expect(applyVoteLocally(voted, 1)).toMatchObject({
      upvote_count: 3,
      downvote_count: 2,
      score: 1,
      viewer_vote: 1,
    });
  });

  it('never mutates the input', () => {
    const original = makeMeme('m1');
    applyVoteLocally(original, 1);

    expect(original).toMatchObject({ upvote_count: 0, score: 0, viewer_vote: null });
  });
});

describe('bumpCommentCount', () => {
  it('increments and decrements', () => {
    expect(bumpCommentCount(makeMeme('m1', { comment_count: 2 }), 1).comment_count).toBe(3);
    expect(bumpCommentCount(makeMeme('m1', { comment_count: 2 }), -1).comment_count).toBe(1);
  });

  it('never goes negative', () => {
    expect(bumpCommentCount(makeMeme('m1', { comment_count: 0 }), -1).comment_count).toBe(0);
  });
});

describe('patchMemeInCaches', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeClient();
  });

  it('patches a meme inside the merged main feed', () => {
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }])],
      pageParams: [0],
    });

    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));

    const data = queryClient.getQueryData<{ pages: MergedFeedPageResponse[] }>(['memes', 'feed']);
    const item = data!.pages[0].items[0];
    expect(item.kind === 'meme' && item.meme.score).toBe(1);
  });

  it('patches the same meme in a community feed at the same time', () => {
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }])],
      pageParams: [0],
    });
    queryClient.setQueryData(['memes', 'community', 'c1'], {
      pages: [{ items: [makeMeme('m1')], next_cursor: null }],
      pageParams: [undefined],
    });

    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));

    const community = queryClient.getQueryData<{ pages: { items: MemeResponse[] }[] }>([
      'memes',
      'community',
      'c1',
    ]);
    expect(community!.pages[0].items[0].viewer_vote).toBe(1);
  });

  it('patches a meme nested inside competition standings', () => {
    queryClient.setQueryData(['competitions', 'day', 'current'], {
      period_type: 'day',
      period_key: '2026-08-06',
      is_closed: false,
      items: [{ rank: 1, content: { kind: 'meme', meme: makeMeme('m1') }, score: 40 }],
    });

    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));

    const standings = queryClient.getQueryData<{
      items: { content: { kind: 'meme'; meme: MemeResponse }; score: number }[];
    }>(['competitions', 'day', 'current']);
    expect(standings!.items[0].content.meme.score).toBe(1);
    // The entry's own score is the scoring atom, computed server-side — voting must not
    // guess at it, only at the meme's own net-vote display score.
    expect(standings!.items[0].score).toBe(40);
  });

  it('leaves other memes and the comments cache untouched by reference', () => {
    const otherPage = mergedPage([{ kind: 'meme', meme: makeMeme('m2') }]);
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }]), otherPage],
      pageParams: [0, 20],
    });
    const comments = [{ id: 'c1', author, body: 'lol', created_at: '2026-08-06T00:00:00.000Z' }];
    queryClient.setQueryData(['memes', 'm1', 'comments'], comments);

    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));

    // Identity preservation is what keeps a vote from re-rendering the whole feed.
    const data = queryClient.getQueryData<{ pages: MergedFeedPageResponse[] }>(['memes', 'feed']);
    expect(data!.pages[1]).toBe(otherPage);
    expect(queryClient.getQueryData(['memes', 'm1', 'comments'])).toBe(comments);
  });

  it('does not touch a container that shares the feed with the target meme', () => {
    const container = makeContainer('ct1');
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }, { kind: 'container', container }])],
      pageParams: [0],
    });

    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));

    const data = queryClient.getQueryData<{ pages: MergedFeedPageResponse[] }>(['memes', 'feed']);
    const item = data!.pages[0].items[1];
    expect(item.kind === 'container' && item.container).toBe(container);
  });
});

describe('patchContainerInCaches', () => {
  it('patches a container in both the merged feed and its own query', () => {
    const queryClient = makeClient();
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'container', container: makeContainer('ct1') }])],
      pageParams: [0],
    });
    queryClient.setQueryData(['instagram', 'containers', 'ct1'], makeContainer('ct1'));

    patchContainerInCaches(queryClient, 'ct1', (container) => applyVoteLocally(container, -1));

    const feed = queryClient.getQueryData<{ pages: MergedFeedPageResponse[] }>(['memes', 'feed']);
    const item = feed!.pages[0].items[0];
    expect(item.kind === 'container' && item.container.viewer_vote).toBe(-1);

    const single = queryClient.getQueryData<MemeContainerResponse>([
      'instagram',
      'containers',
      'ct1',
    ]);
    expect(single).toMatchObject({ downvote_count: 1, score: -1, viewer_vote: -1 });
  });
});

describe('markScoreSurfacesStale', () => {
  // Regression guard for the whole point of this phase: an interaction may refresh the
  // off-screen score surfaces, but it must never invalidate the feed — the feed is
  // Hot-ranked, so a refetch re-runs the ranking and moves the card under the user.
  it('marks the score surfaces stale and leaves the feed alone', () => {
    const queryClient = makeClient();
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }])],
      pageParams: [0],
    });
    queryClient.setQueryData(['memes', 'community', 'c1'], {
      pages: [{ items: [makeMeme('m1')], next_cursor: null }],
      pageParams: [undefined],
    });
    queryClient.setQueryData(['leaderboards', 'individual'], []);
    queryClient.setQueryData(['competitions', 'day', 'current'], { items: [] });

    markScoreSurfacesStale(queryClient);

    expect(queryClient.getQueryState(['memes', 'feed'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['memes', 'community', 'c1'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['leaderboards', 'individual'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['competitions', 'day', 'current'])?.isInvalidated).toBe(true);
  });
});

describe('snapshot / restore', () => {
  it('rolls every patched cache back to its pre-mutation state', () => {
    const queryClient = makeClient();
    queryClient.setQueryData(['memes', 'feed'], {
      pages: [mergedPage([{ kind: 'meme', meme: makeMeme('m1') }])],
      pageParams: [0],
    });
    queryClient.setQueryData(['memes', 'community', 'c1'], {
      pages: [{ items: [makeMeme('m1')], next_cursor: null }],
      pageParams: [undefined],
    });

    const snapshot = snapshotContentCaches(queryClient, 'meme');
    patchMemeInCaches(queryClient, 'm1', (meme) => applyVoteLocally(meme, 1));
    restoreContentCaches(queryClient, snapshot);

    const feed = queryClient.getQueryData<{ pages: MergedFeedPageResponse[] }>(['memes', 'feed']);
    const item = feed!.pages[0].items[0];
    expect(item.kind === 'meme' && item.meme).toMatchObject({ score: 0, viewer_vote: null });

    const community = queryClient.getQueryData<{ pages: { items: MemeResponse[] }[] }>([
      'memes',
      'community',
      'c1',
    ]);
    expect(community!.pages[0].items[0]).toMatchObject({ score: 0, viewer_vote: null });
  });
});
