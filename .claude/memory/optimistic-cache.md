# optimistic-cache

## Status
Done (Phase 17, 2026-08-06) — frontend-only. `tsc` clean, `expo lint` 0 errors (2 pre-existing react-hook-form `watch()` warnings unrelated), jest 51/51 (16 new). No human tap-through yet.

**Why the phase existed**: a CTO review flagged that voting "reloads the page." It did — and worse than reported. Before this, *every* mutation in the app was invalidate-and-refetch; a repo-wide audit found **zero** uses of `onMutate`/`setQueryData`/`cancelQueries`. `useCastVoteMutation` invalidated the `['memes']` **prefix**, so one upvote refetched every loaded feed page. Because the main feed is Hot-ranked and offset-paginated ([[meme-feed]]), that refetch re-ran the ranking — cards could reorder, duplicate, or vanish mid-scroll. Voting could move the card you just voted on.

## What it is
`frontend/src/services/optimisticCache.ts` — the single place that patches a cached meme/container in place instead of refetching. Not a hook (per frontend/CLAUDE.md's no-custom-hooks rule); plain functions called from mutation callbacks.

- `applyVoteLocally(item, value)` — mirrors the backend's toggle/flip semantics ([[voting-system]]): re-casting the value you hold removes the vote, the opposite flips it (±2 on score), otherwise it's new. **Keep in sync with `backend/app/services/votes.py`.**
- `bumpCommentCount(item, delta)` — clamped at 0.
- `patchMemeInCaches(qc, memeId, patch)` / `patchContainerInCaches(qc, containerId, patch)`.
- `snapshotContentCaches(qc, kind)` / `restoreContentCaches(qc, snapshot)` — rollback pair for `onError`.
- `cancelContentQueries(qc, kind)` — awaited in `onMutate`. **Deliberately skips the `['memes']` prefix** — see Gotchas.
- `markScoreSurfacesStale(qc)` — invalidates `['leaderboards']` + `['competitions']` with **`refetchType: 'none'`**.

## Business rules
- **Never invalidate a feed key from an interaction mutation.** This is the whole point of the module. Off-screen score surfaces are marked stale (`refetchType: 'none'` → refetch on next mount, no network now); the feed is patched and left alone. Hot-rank reordering happens only on explicit pull-to-refresh. Guarded by a test.
- **Identity preservation is load-bearing, not an optimization.** Every walker branch returns the original node by reference when nothing changed, so TanStack notifies only the one card's subscriber instead of re-rendering every list on screen. Breaking this silently reintroduces the full-feed re-render the phase existed to remove.
- **`onSuccess` reconciles against the server's authoritative counts** — the optimistic guess drifts whenever someone else voted on the same content in between.
- Snapshots are cheap: every cached tree is immutable and the patch never mutates in place, so a snapshot stores root references, not copies.
- **Vote buttons stay `disabled` while pending** (unchanged from before). This serializes taps and avoids out-of-order `onSuccess` reconciliation. Known minor gap: rapid tapping is silently ignored rather than queued — TanStack v5 mutation `scope` would serialize properly if this ever matters.

## The shapes it walks
One entity is cached in several differently-shaped places at once. `patchNode` handles exactly these; anything else passes through untouched:
| Shape | Where |
|---|---|
| `{ pages: [...] }` | `InfiniteData` — main feed, community feeds |
| `{ items: [...] }` | feed page / standings page envelope |
| `{ content: <tagged> }` | competition standings entry, winner |
| `{ kind: 'meme' \| 'container', ... }` | merged-feed / standings tagged union |
| bare entity | the single-container query |

Prefixes scanned: meme → `['memes']`, `['competitions']`; container → those plus `['instagram']`. `['memes']` also covers the comments caches, which the walker passes through by reference.

## Gotchas
- **Never `cancelQueries` the paginated feed caches.** The obvious reading of the TanStack optimistic recipe is "cancel everything you're about to patch," but cancelling `['memes']` aborts an in-flight `fetchNextPage`, and `FlatList` won't re-fire `onEndReached` until the user scrolls again — infinite scroll silently dies. It's also unnecessary: `fetchNextPage` *appends* a page and can't overwrite an already-patched card, and the only thing that rewrites existing pages is a user-initiated pull-to-refresh. `cancelContentQueries` filters the prefix out for exactly this reason.
- **A competition standings entry has its own `score` field that is the [[scoring-engine]] atom, NOT the meme's net-vote score.** Patching a vote must only touch the nested meme/container's own vote fields and leave the entry's `score` alone — the atom is server-computed and can't be guessed client-side. Locked by a test.
- **`viewer_vote` presence is the "is this a votable entity" marker** in `patchEntity` — `id` alone isn't enough, since other objects cached under these prefixes also have ids.
- **Tests import globals from `@jest/globals` explicitly** — this repo has no `@types/jest`, so bare `describe`/`it`/`expect` typecheck fine under jest but fail `tsc --noEmit`. Follow the existing convention in `creatorDraftSlice.test.ts`.
- **A `QueryClient` built with default `gcTime` keeps jest alive after the run** ("Jest did not exit one second after..."). Tests construct clients via a tracked `makeClient()` with `gcTime: Infinity` and `clear()` them in `afterEach`.

## Key files
- frontend: `src/services/optimisticCache.ts` (+ `.test.ts`), `src/services/useMemes.ts` (`useCastVoteMutation`, `useAddCommentMutation`), `src/services/useInstagram.ts` (`useCastContainerVoteMutation`, `useAddContainerCommentMutation`), `src/components/VotePill.tsx`.
- Untouched on purpose: `useCreateMemeMutation`/`useCreateCommunityMemeMutation`/`useCreateContainerMutation` still invalidate feed keys — a *new post* should appear, which is a refetch, not an in-place patch.

## Tests
- `frontend/src/services/optimisticCache.test.ts` (16): all five vote transitions + non-mutation of input; comment bump incl. the 0 clamp; patching across merged feed / community feed / competition standings simultaneously; standings' atom `score` left untouched; other memes, sibling containers, and the comments cache preserved **by reference**; container patched in both merged feed and its own query; snapshot→patch→restore rollback; and the regression guard that `markScoreSurfacesStale` marks `['leaderboards']`/`['competitions']` invalidated while leaving both feed caches untouched.
