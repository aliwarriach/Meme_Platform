import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { MemeContainerResponse } from '@/services/instagram';
import type { MemeResponse } from '@/services/memes';

/**
 * Optimistic cache patching for the interaction surfaces (votes, comment counts).
 *
 * Why this exists: a meme or container is cached in several differently-shaped places at
 * once (main feed, community feed, competition standings, single-container query). Before
 * this module every interaction mutation just invalidated the `['memes']` prefix, which
 * refetched every loaded feed page — and because the main feed is Hot-ranked and
 * offset-paginated, that refetch re-ran the ranking and could reorder or duplicate cards
 * out from under the user's thumb. Patching the cached entity in place instead keeps the
 * feed still: only the number changes.
 *
 * Everything here is identity-preserving — a node that didn't change is returned by
 * reference, so TanStack Query only notifies the one subscriber that actually needs to
 * re-render rather than every list on screen.
 */

/** The vote fields `MemeResponse` and `MemeContainerResponse` have in common. */
export interface VotableFields {
  upvote_count: number;
  downvote_count: number;
  score: number;
  viewer_vote: 1 | -1 | null;
}

export type VotableKind = 'meme' | 'container';

type Entity = VotableFields & { id: string };
type Patch<T> = (item: T) => T;

interface Target {
  kind: VotableKind;
  id: string;
  patch: Patch<Entity>;
}

/**
 * Applies the backend's vote toggle/flip semantics locally: re-casting the value you
 * already hold removes the vote, casting the opposite flips it in place, otherwise it's a
 * new vote. Mirrors `backend/app/services/votes.py` — keep the two in sync.
 */
export function applyVoteLocally<T extends VotableFields>(item: T, value: 1 | -1): T {
  const viewer_vote = item.viewer_vote === value ? null : value;
  const upvote_count =
    item.upvote_count - (item.viewer_vote === 1 ? 1 : 0) + (viewer_vote === 1 ? 1 : 0);
  const downvote_count =
    item.downvote_count - (item.viewer_vote === -1 ? 1 : 0) + (viewer_vote === -1 ? 1 : 0);

  return { ...item, upvote_count, downvote_count, score: upvote_count - downvote_count, viewer_vote };
}

/** Comment counts are denormalized onto the feed entity, so they need patching too. */
export function bumpCommentCount<T extends { comment_count: number }>(item: T, delta: number): T {
  return { ...item, comment_count: Math.max(0, item.comment_count + delta) };
}

function mapPreservingIdentity<T>(items: T[], fn: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    const mapped = fn(item);
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? next : items;
}

function patchEntity(entity: unknown, target: Target): unknown {
  if (entity === null || typeof entity !== 'object') return entity;

  const record = entity as Record<string, unknown>;
  // `viewer_vote` is the marker for "this is a votable entity" — it's present (possibly
  // null) on every meme/container and absent on everything else cached under these keys.
  if (record.id !== target.id || !('viewer_vote' in record)) return entity;

  return target.patch(entity as Entity);
}

/**
 * Walks the structural wrappers this app actually caches and patches the target entity
 * wherever it appears. Any node shape not listed here is returned untouched:
 *   `{ pages: [...] }`                      InfiniteData — main feed, community feeds
 *   `{ items: [...] }`                      feed page / standings page envelope
 *   `{ content: <tagged> }`                 standings entry, competition winner
 *   `{ kind: 'meme' | 'container', ... }`   merged-feed / standings tagged union
 *   bare entity                             the single-container query
 */
function patchNode(node: unknown, target: Target): unknown {
  if (node === null || typeof node !== 'object') return node;

  if (Array.isArray(node)) return mapPreservingIdentity(node, (item) => patchNode(item, target));

  const record = node as Record<string, unknown>;

  if (Array.isArray(record.pages)) {
    const pages = mapPreservingIdentity(record.pages, (page) => patchNode(page, target));
    return pages === record.pages ? node : { ...record, pages };
  }

  if (Array.isArray(record.items)) {
    const items = mapPreservingIdentity(record.items, (item) => patchNode(item, target));
    return items === record.items ? node : { ...record, items };
  }

  if ('content' in record) {
    const content = patchNode(record.content, target);
    return content === record.content ? node : { ...record, content };
  }

  if (record.kind === 'meme' || record.kind === 'container') {
    if (record.kind !== target.kind) return node;
    const field = target.kind;
    const patched = patchEntity(record[field], target);
    return patched === record[field] ? node : { ...record, [field]: patched };
  }

  return patchEntity(node, target);
}

// A meme can surface in any feed cache and in competition standings. A container can do
// both of those plus its own single-container query. `['memes']` also covers the comments
// caches, which the walker passes through untouched.
const MEME_CACHE_PREFIXES: QueryKey[] = [['memes'], ['competitions']];
const CONTAINER_CACHE_PREFIXES: QueryKey[] = [['memes'], ['competitions'], ['instagram']];

const prefixesFor = (kind: VotableKind) =>
  kind === 'meme' ? MEME_CACHE_PREFIXES : CONTAINER_CACHE_PREFIXES;

export type CacheSnapshot = [QueryKey, unknown][];

/**
 * Cheap because every cached tree is immutable — a snapshot stores root references, not
 * copies, and the patch below never mutates in place.
 */
export function snapshotContentCaches(
  queryClient: QueryClient,
  kind: VotableKind
): CacheSnapshot {
  return prefixesFor(kind).flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
}

export function restoreContentCaches(queryClient: QueryClient, snapshot: CacheSnapshot): void {
  snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

/**
 * Cancels in-flight fetches that could land after the patch and clobber it.
 *
 * The paginated `['memes']` caches are deliberately excluded. `fetchNextPage` only
 * *appends* a page, so it can never overwrite an already-patched card — but cancelling it
 * mid-flight would abort pagination, and `FlatList` won't re-fire `onEndReached` until the
 * user scrolls again, silently killing infinite scroll. The only thing that rewrites
 * existing feed pages is a full refetch, which since Phase 17 is user-initiated
 * (pull-to-refresh) — where fresh server data is exactly what was asked for.
 */
export function cancelContentQueries(queryClient: QueryClient, kind: VotableKind): Promise<void[]> {
  const cancellable = prefixesFor(kind).filter((queryKey) => queryKey[0] !== 'memes');
  return Promise.all(cancellable.map((queryKey) => queryClient.cancelQueries({ queryKey })));
}

function patchInCaches(queryClient: QueryClient, target: Target): void {
  prefixesFor(target.kind).forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (data: unknown) => patchNode(data, target));
  });
}

export function patchMemeInCaches(
  queryClient: QueryClient,
  memeId: string,
  patch: Patch<MemeResponse>
): void {
  patchInCaches(queryClient, {
    kind: 'meme',
    id: memeId,
    patch: (entity) => patch(entity as MemeResponse),
  });
}

/**
 * An interaction moves the scoring atom behind the leaderboards and competition standings,
 * but those live on other screens — mark them stale so they refresh on next visit instead
 * of refetching now. The feed is deliberately NOT invalidated by any caller of this: it's
 * Hot-ranked, so a refetch would re-run the ranking and move the card the user just touched.
 */
export function markScoreSurfacesStale(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['leaderboards'], refetchType: 'none' });
  queryClient.invalidateQueries({ queryKey: ['competitions'], refetchType: 'none' });
}

export function patchContainerInCaches(
  queryClient: QueryClient,
  containerId: string,
  patch: Patch<MemeContainerResponse>
): void {
  patchInCaches(queryClient, {
    kind: 'container',
    id: containerId,
    patch: (entity) => patch(entity as MemeContainerResponse),
  });
}
