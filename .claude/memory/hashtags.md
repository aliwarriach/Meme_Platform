# hashtags

## Status
Done, backend and frontend (Phase 20 backend 2026-08-06; frontend 2026-08-07 alongside the Phase 18 Compete tab — see [[challenges]]'s "Phase 18 + 20 frontend" section for the full cross-feature picture). Migration `f4a7b2c9d813` applied to dev. Frontend `tsc`/`expo lint`/`expo export --platform web` clean (24 routes, including `/tag/[slug]`).

**2026-08-27 — Roadmap_Search.md S1, reservation lifecycle + anti-squatting.** A reservation is
no longer permanent: it now only holds while the owning challenge is `setup`/`active`, released
the moment it's `evaluated`. See [[challenges]]'s S1 section for the four guards.

**2026-08-27 — Roadmap_Search.md S5, tag screen.** New `GET /hashtags/{slug}/memes/hot` route
(Hot-ranked, offset-paginated — see Endpoints below). `HashtagOut.challenge_id` (the deprecated
S1 alias) has been **removed outright**, not just deprecated further — the only two frontend
readers (`TagFeedScreen`'s banner, `HashtagInput`'s autocomplete) either never read it
(`HashtagInput` only ever read `HashtagSuggestion.challenge_id`, a different, non-deprecated
field from `/hashtags/search`) or were migrated to `active_challenge` in this same changeset, so
there was no reason to keep the alias around. `test_open_challenges.py`'s two tests that asserted
on `challenge_id` were updated to assert on `active_challenge.id` instead.

## Why tags are entities, not parsed caption text
The obvious design — "type `#DogsVsCats` and a team name in your caption to enter" — was rejected during the Phase 20 design review, for two reasons that are worth not re-litigating:
- **Silent failure.** A typo, wrong casing, or a missing tag would drop a meme out of the competition with *no feedback to the poster*. They'd see a normal successful post and only discover at results time that it never counted. The single most important action in the feature would be invisible and unverifiable.
- **Squatting.** Nothing stops two challenges claiming one tag, or someone hijacking a popular challenge's tag for reach.

So: a tag is a row, a challenge **reserves** one exclusively, and the creator resolves what the user types against the table *before* publish — entry becomes an explicit confirmed action. An unresolved tag is still a fine discovery tag; it just never counts as a challenge entry.

## Models
- `Hashtag` (`app/models/hashtag.py`), table `hashtags`: `slug` (unique, indexed — the normalized lookup key), `display_text` (what was typed, for display casing).
- `MemeHashtag` (same file), table `meme_hashtags`: `meme_id`, `hashtag_id`, `UniqueConstraint(meme_id, hashtag_id)`.
- `challenges.hashtag_id` — nullable, **unique**, FK → `hashtags.id` `ondelete=RESTRICT` (RESTRICT not CASCADE: deleting a tag under a live challenge would orphan its only entry mechanism). Set only for `open` challenges, see [[challenges]].

## Normalization
`normalize_hashtag()` — strip, drop leading `#`, lowercase, remove every non-alphanumeric. `"#Dogs-Vs-Cats"`, `"dogsvscats"` and `"#DOGSVSCATS"` all collapse to `dogsvscats`. Empty result → 400. Max 100 chars. **This is the whole anti-forking mechanism** — if casing or punctuation created separate tags, an open challenge's entry tag would split into dead variants.

## Endpoints
All Bearer-auth-gated, registered in `app/routers/hashtags.py` under `/hashtags`.
- `GET /hashtags/search?q=&limit=` → `list[HashtagSuggestion]` = `{id, slug, display_text, challenge_id, challenge_title}`. Prefix match on the normalized slug. **Challenge-owning tags sort first** (`order_by(Challenge.id.is_(None), Hashtag.slug)`) — that's the point of the autocomplete: turning a typed tag into a real, confirmable entry. Empty/punctuation-only query returns `[]`, not an error.
- `GET /hashtags/{slug}` → `HashtagOut` = `{id, slug, display_text, meme_count, active_challenge, recent_result_challenge}`. `404` unknown. `active_challenge: ChallengeOut | None` is the currently-`active`/`setup` challenge owning this tag (at most one, enforced by the partial unique index — see [[challenges]] S1). `recent_result_challenge: ChallengeOut | None` is a challenge on this tag that finished (`evaluated`) within the last 24h (`RESULT_CARD_GRACE_HOURS` in `services/hashtags.py`); both can be non-null at once (a new challenge can claim a tag whose predecessor is still inside its 24h result window) — per Roadmap_Search.md §1.4 the frontend renders the live one above the result card. Building these embeds a full `ChallengeOut`, which needs a `viewer_id` — `get_hashtag(db, slug, viewer_id)` takes one (see [[challenges]] S4).
- `GET /hashtags/{slug}/memes?cursor=&limit=` → `FeedPage` — the **Latest** tag feed, keyset-paginated.
- `GET /hashtags/{slug}/memes/hot?offset=&limit=` → `HotFeedPage` (2026-08-27, S5) — the **Hot** tag feed, offset-paginated. A second route rather than a `sort=` param on the one above: Hot's score drifts every second and has no stable keyset cursor, so the two are genuinely different pagination contracts (same precedent as `services/memes.py`'s `get_hot_ranked_memes` vs `_paginated_feed`). Same visibility gating as the Latest route — `meme_visibility_clause` + tag filter, just Hot-ranked instead of recency-ranked.

## Business rules
- **`get_or_create_hashtag` and `attach_hashtags` do not commit** — the caller owns the transaction, so a meme + its tags + a challenge submission all land atomically.
- **`attach_hashtags` dedupes by normalized slug** before inserting, so `"#Cats #cats"` doesn't produce two rows and trip the unique constraint. Capped at `MAX_HASHTAGS_PER_MEME` (=5).
- **A unique-slug race is resolved by re-reading, not failing** — two people tagging the same thing at once is normal, not an error.
- **The tag feed reuses `services/memes.py::_paginated_feed` + `meme_visibility_clause`.** A tag must never widen who can see a meme: a friends-only post carrying a public tag stays friends-only. Reusing the feed's own clause is what guarantees that rather than a parallel rule that can drift.
- `POST /memes` accepts a repeated `hashtags` form field (personal posts). **Community posts (`POST /communities/{id}/memes`) do NOT accept tags yet** — deliberate scope limit, flag if product wants it.

## Gotchas
- **`services/hashtags.py` imports from `services/memes.py` lazily, inside the function** (`_paginated_feed`, `meme_visibility_clause`), and `services/memes.py` imports `attach_hashtags` lazily too. Both directions are deliberate — a module-scope import either way is a circular import. Don't "clean this up" by hoisting them.
- **2026-08-27 (S1): the same trap applies to `_build_hashtag_out` → `services/challenges.py::_build_challenge_out`.** `services/challenges.py` imports `get_or_create_hashtag` from this module at module scope, so building the embedded `ChallengeOut`s inside `_build_hashtag_out` imports `_build_challenge_out` lazily, inside the function. `schemas/hashtags.py` importing `schemas/challenges.py` at module scope is fine (schemas never import services, no cycle there).
- **`challenges.hashtag_id`'s uniqueness is now a *partial* index (`uq_challenge_live_hashtag`, `WHERE hashtag_id IS NOT NULL AND status <> 'evaluated'`), not a plain unique column/index.** See [[challenges]] S1 for the full migration/model story — relevant here because `_build_hashtag_out` depends on "at most one non-evaluated challenge per tag" actually being enforced at the DB level, not just by the service-layer pre-check.
- **`_paginated_feed` is underscore-private but imported across service modules anyway.** Duplicating keyset pagination + the vote/comment count subqueries would be strictly worse; the alternative considered and rejected was putting hashtag logic inside the meme service.
- **The `challenge_type` enum gained `'open'` via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`** in migration `f4a7b2c9d813`. Safe in one migration *only because nothing in that migration writes a row using it* — Postgres forbids using a brand-new enum value in the transaction that added it, and this repo's `env.py` runs a whole upgrade in one transaction (same trap documented in [[meme-feed]]).
- **Migration was hand-written, not autogenerated** — a concurrent session was mid-flight on the messaging models and autogenerate would have swept their in-progress changes into this revision.

## Frontend integration notes
- `services/hashtags.ts` (REST + wire types) + `services/useHashtags.ts` (`useHashtagSearch` — enabled only once the query is non-empty, matching the backend's empty-query-returns-`[]` behaviour; `useHashtag` — polls every 5s while `active_challenge` is present, same rationale as `useChallenge`'s active/setup poll; `useHashtagFeed(slug, sort)`).
- `features/challenges/components/HashtagInput.tsx` — the creator's tag chips + debounced autocomplete dropdown, personal-post mode only (community posts and challenge-mode submissions never show it — matches the backend's "community posts don't accept tags yet" limit and the fact that challenge-mode already auto-attaches its own tag). Selecting a suggestion that carries a `challenge_id` (from `HashtagSuggestion`, `/hashtags/search` — unrelated to the now-removed `HashtagOut.challenge_id`) opens a **required side-picker** (fetches the challenge via `useChallengeFlat` for its `sides`) before the tag is accepted — never silently added like a plain tag. See [[challenges]]'s Business rules for why picking a side here reuses the challenge-submission endpoints (`join_open_challenge` + `create_and_submit_to_challenge`) rather than `POST /memes`'s `hashtags` field.
- **2026-08-27, Roadmap_Search.md S5 — `features/hashtags/TagFeedScreen.tsx`** (route `/tag/[slug]`) reworked: `ListHeaderComponent` (not a nested `ScrollView`) stacks `ChallengeRaceHeader` (from `active_challenge`) → `ChallengeResultCard` (from `recent_result_challenge`, live one always on top when both present) → a `[Hot | Latest]` `SegmentedControl`, then `MemeFeedList` fed by `useHashtagFeed(slug, sort)`. `sort` defaults to `'hot'`. `useHashtagFeed` always calls **both** the Hot and Latest underlying `useInfiniteQuery`s (each `enabled` only when it's the active sort) rather than conditionally calling one or the other — the latter would violate the rules of hooks; this way the inactive tab's data also stays cached across toggles.
- `features/hashtags/components/{ChallengeRaceHeader,ChallengeResultCard}.tsx` — new, native-only so far (no `.web.tsx` variants yet; S7 covers desktop-web parity for the tag screen).
- **`ChallengeOut.viewer_side_id` (S4) also fixed a real pre-existing bug**: `DuelDetailScreen.tsx`/`.web.tsx` (which also renders `open` challenges) used to track "which side did I join" in local component state, resetting on every remount — replaced with `challenge.viewer_side_id` directly, both native and web.

## Key files
- backend: `app/models/hashtag.py`, `app/schemas/hashtags.py`, `app/services/hashtags.py`, `app/routers/hashtags.py`, `app/models/challenge.py` (`hashtag_id`), `app/services/memes.py` (`stage_personal_meme`, `create_meme(hashtags=...)`), `app/routers/memes.py` (`hashtags` form field), `app/core/exceptions.py` (`HashtagInvalidError`/`HashtagNotFoundError`/`HashtagAlreadyReservedError`), `alembic/versions/f4a7b2c9d813_add_hashtags_and_open_challenges.py`.
- frontend: `src/services/{hashtags,useHashtags}.ts`, `src/features/challenges/components/HashtagInput.tsx`, `src/features/hashtags/TagFeedScreen.tsx`, `src/app/tag/[slug].tsx`, `src/services/memes.ts`/`useMemes.ts` (`hashtags` field threaded through `createMemeRequest`/`useCreateMemeMutation`).

## Tests
- `backend/tests/test_open_challenges.py` — tag reservation is exclusive across casing/punctuation variants (409), normalization on create, search ordering puts challenge tags first, tag detail reports its challenge, unknown tag 404, and an open-challenge entry lands in the tag feed.
