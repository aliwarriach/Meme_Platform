# Roadmap — UX Overhaul (Phases 17–21)

**Created:** 2026-08-06 · **Trigger:** CTO review — "backend is near flawless, the UX needs a lot of improvements."

This document covers the four changes raised in review (challenge discoverability, open/hashtag challenges, real chat inbox, optimistic voting), an assessment of each, and additions found while auditing the current code. Scope changes here **contradict two existing spec decisions** — see §6.

---

## 1. Diagnosis — verified against the code, not assumed

### 1.1 Challenges are three navigation layers deep
`components/FloatingBottomNav.tsx` exposes exactly five destinations: `feed`, `communities`, `create`, `leaderboards`, `profile`. Challenges appear in none of them.

The only path to a challenge is: `/communities` → open a community → **Challenges tab** → challenge detail. That requires the user to already be a member of a community that already has an active challenge. There is no cross-community "what am I competing in" surface anywhere in the app.

**Worse: challenges can only be created by community owners.** Both `POST /communities/{id}/challenges` and `POST /communities/{id}/challenges/vs/{opponent}` are owner-gated. A regular user cannot start a challenge with anyone, ever. That is the single biggest structural cap on the feature.

### 1.2 Submitting a meme to a challenge takes seven steps across three screens
`features/challenges/components/SubmissionPicker.tsx` sources candidate memes from `useCommunityFeed` filtered to the viewer's own posts. Its empty state is the tell:

> "Post a meme in this community first, then come back here to submit it."

So the real flow is:

1. Open the community
2. Tap "+ Post"
3. Shoot/pick image, caption, publish to the community
4. Navigate back to the community
5. Open the Challenges tab
6. Open the challenge
7. Find your meme in a horizontal strip and tap Submit

The creator has **no idea a challenge exists**. There is no `challengeId` param, no banner, no post-publish prompt. The user must independently know that posting and submitting are two different actions — which nothing in the UI tells them. This is the flow the CTO is describing, and it is worse than "hidden": it is undiscoverable by design.

For `community_vs_community` challenges it is stricter still — the backend requires the meme to *already* carry a `community`-typed `PostAudience` row for the submitter's side, so a meme created from the main feed creator is permanently ineligible with no explanation shown to the user.

### 1.3 The inbox is a flat firehose, not conversations
`features/meme-sending/InboxList.tsx` renders a single `FlatList` over `GET /meme-sending/inbox` — every `MemeSend` from every sender, newest first, interleaved. There is no grouping by sender, no thread screen, no way to open a conversation, and no way to start a new one from the inbox (sending is only reachable from a meme's "↗ Send" button in the feed).

Replies are four hardcoded emoji (`QUICK_REACTIONS = ['😂','❤️','🔥','😮']`). There is no text messaging and **no message model on the backend at all** — `MemeSend.reaction` is a single nullable string column, overwritten on each reaction. There is no conversation entity to build a thread from.

### 1.4 Voting refetches the entire feed — and can reorder it under the user's thumb
```ts
// services/useMemes.ts:132
onSuccess: () => queryClient.invalidateQueries({ queryKey: memesRootKey }),  // ['memes']
```
`memesRootKey` is the `['memes']` **prefix**, so a single upvote invalidates the infinite feed query and every loaded page refetches.

Two compounding problems:

- The main feed is **Hot-ranked and offset-paginated** (per `meme-feed.md`). Hot score drifts continuously with time, so a refetch re-runs the ranking — items shift position, and with offset pagination over a shifted ranking, memes can **duplicate or disappear** mid-scroll. Voting can literally move the card you just voted on.
- `components/VotePill.tsx` swaps the score number for an `ActivityIndicator` while `isVoting`. The number visibly vanishes on every tap, then reappears, then the list reshuffles.

**This is systemic, not local.** A repo-wide audit found **zero** uses of `onMutate`, `setQueryData`, or `cancelQueries`. Every mutation in the app — votes, comments, container votes (`useInstagram.ts:57`), joins, reactions — is invalidate-and-refetch. There is no optimistic update anywhere.

---

## 2. Assessment of the four proposed changes

| # | Proposal | Verdict |
|---|---|---|
| 1 | Surface challenges out of communities | **Agree, do it first.** Root cause is worse than nav depth — see §2.1. |
| 2 | Guide users into posting to a challenge | **Agree, highest leverage change in this document.** |
| 3 | Open challenges via hashtags | **Agree on the goal, change the mechanism.** See §2.3 — free-text tags fail silently and are gameable. |
| 4 | Real chat inbox | **Agree.** Note this reverses a documented scope decision — see §6. |
| 5 | Optimistic voting ("AJAX") | **Agree, ship first — cheapest high-impact fix here.** |

### 2.1 Surfacing challenges — the nav slot problem
The bottom nav is full at five slots. Rather than cram a sixth (which breaks the ≥44pt touch-target rule on small phones), **merge Leaderboards and Challenges into one "Compete" destination** with a segmented control:

```
Feed  ·  Communities  ·  [ + ]  ·  Compete  ·  Profile
                                   └─ Challenges | Leaderboards
```

They are conceptually the same thing — competition surfaces driven by the same scoring atom. This elevates challenges to top-level without losing leaderboards or growing the nav.

### 2.2 Guiding submission — fix the creator, not the picker
The fix is not a better `SubmissionPicker`; it is making the **creator challenge-aware**. Enter the creator *from* a challenge → it carries `challengeId` + `sideId` → shows a persistent "Competing in *X* for *Y*" banner → on publish it posts **and** submits in one action.

That collapses seven steps to two, and it works today with zero new challenge shapes. Do this before hashtags.

> **Implementation constraint:** do the post-then-submit chain in **one backend endpoint** (multipart), not two client calls. On mobile networks a two-call chain will strand memes in the "posted but not submitted" state — which is precisely the confusing half-state the current UX already produces, just automated. One endpoint, one transaction.

### 2.3 Hashtags — right goal, risky mechanism

The intent (challenges escape community walls, anyone joins by posting) is correct. Two problems with free-text hashtags as the join mechanism:

**Problem 1 — silent failure.** If joining a challenge means "type `#DogsVsCats` and a team token in your caption," then a typo, a missing tag, a homoglyph, or wrong casing means the meme silently doesn't count. The user gets no error, sees their meme posted normally, and only discovers it never counted when results land. Caption-parsing makes the *most important action in the feature* invisible and unverifiable.

**Problem 2 — tag squatting and collision.** Free text means two unrelated challenges can claim the same tag, and anyone can hijack a popular challenge's tag to farm reach.

**Recommended instead — hashtags as first-class entities, join as a structured action:**

- A challenge **owns** a unique, reserved, normalized tag (`#dogsvscats`). Reserved at creation; no other challenge can take it.
- Typing `#` in the creator triggers **autocomplete**. Resolving to a real challenge surfaces a **required side-picker chip** ("Which side? 🐕 Dogs / 🐈 Cats") — structured, explicit, confirmable before publish.
- An unresolved free-typed tag is just a normal discovery tag. It is **never** silently treated as a submission.
- Result: the user gets everything they asked for (post with a tag → you're in), with the join being an explicit confirmed action rather than a parsed string.

**Problem 3 — open participation breaks the scoring model.** This one is not optional.

`services/challenges.py::_side_score` **sums** each side's submitted meme scores. Inside a community with an assigned roster that is fine. Open to the entire platform, sum-based scoring means **the side that posts the most memes wins**, regardless of quality — and one prolific user can single-handedly decide every open challenge. This is exactly the "resistant to gaming, abuse, brigading, low-effort mass-posting" bar that `Project_Requirements.md` §7 sets.

Required alongside open challenges:
- **Per-user contribution cap** — only a user's top *N* (start at 3) memes count toward a side.
- **Breadth weighting** — factor in *how many distinct people* contributed, mirroring the breadth-averaging the community leaderboard already uses. A side of 50 people each posting one good meme should beat one person posting 50.

Both are changes to `_side_score` only. The atom itself is untouched.

### 2.4 Chat — generalize `MemeSend`, don't add a parallel table
Do **not** add a `Message` table beside `meme_sends`. A thread view would then have to merge two tables with different shapes, and keyset pagination across a union is painful and slow.

Instead: `Conversation` + `Message(kind: text | meme, body, meme_id)`, and migrate existing `meme_sends` rows into it. One table, one ordering, one cursor.

> **Carry the IDOR fix forward.** `meme-sending.md` documents a real vulnerability fixed in Phase 16: `send_meme` originally used a raw `db.get(Meme, id)`, letting anyone forward a meme they couldn't see. Meme attachments in the new message flow **must** resolve through `services/memes.py::get_visible_meme`. This is the most likely regression in the whole roadmap — the regression test `test_cannot_send_a_meme_you_cannot_see` must be ported to the new endpoint, not just left passing against the old one.

### 2.5 Optimistic voting — agreed, and broader than voting
Ship this first. It is the cheapest fix with the most visible payoff, and it is pure frontend.

Because the pattern is missing everywhere, build **one shared cache-patch helper** in `services/` rather than hand-rolling `onMutate` five times — the feed, community feed, single-meme, competition standings, and container caches all need the same delta applied.

Critical detail: **do not invalidate the feed on settle.** Invalidating after an optimistic update reintroduces the exact reshuffle we are removing. Patch the cache and stop; let Hot-rank reordering happen only on explicit pull-to-refresh. Invalidate *other* surfaces (leaderboards, challenge scores) freely — those aren't under the user's thumb.

---

## 3. Additions found during the audit — not raised in review

### 3.1 Live challenge scoreboards (highest engagement-per-hour item here)
`ChallengeSideOut.score` already exists in the API contract and is **always `null`** — documented as "unused, reserved for a future live-tally UI." Meanwhile `_side_score` already computes exactly this number for evaluation.

So today: during the entire active window, a competitor **cannot see whether their side is winning.** They post into a void and find out at the end. A challenge with no visible scoreboard is not a competition — it's a submission form.

Wiring the existing `_side_score` into the existing read path is roughly half a day of backend work and probably the largest single motivational gain available. Add a countdown timer next to it.

### 3.2 There are no notifications of any kind
Challenge started, ending in 1 hour, your side got overtaken, you won, someone sent you a meme — none of these reach the user. Fixing navigation makes challenges *findable*; notifications make them *unmissable*. Without this, the Compete tab only works for users who already remember to check it.

The arq infrastructure for scheduled jobs already exists (`redis-arq-infra.md`), so scheduled challenge notifications are cheap to add.

### 3.3 Cold start — an empty Compete tab is worse than no tab
Open challenges only work when there are challenges to join. A new user who taps a brand-new top-level tab and finds nothing concludes the feature is dead and never returns.

Mitigation: **platform-run weekly open challenges** ("house" challenges) so the tab is never empty. Cheap, and it doubles as the worked example that teaches the mechanic.

### 3.4 1v1 friend duels — the cheapest viral shape, and it is literally what was asked for
"Allow everyone to have challenges with anyone" describes a **direct duel** more precisely than an open challenge does. Once open challenges exist, a duel is nearly free: an open challenge with two sides of one, created by invite, riding the friends system and the new chat inbox for the invite delivery.

This is likely to out-perform open hashtag challenges on engagement, because it has a named opponent and a personal stake. Worth building in the same phase.

### 3.5 Instagram containers will collide with challenge hashtags
`MemeContainer`s are ineligible for challenge submission (`Project_Requirements.md` §13, confirmed decision). The moment hashtags exist, someone will share a Reel with a challenge tag and expect it to count. Eligibility today only checks `Meme.author_id`, so this needs an **explicit, visible rejection message** — not a silent drop. Small, but it will otherwise become a recurring support complaint.

### 3.6 The scoring system is invisible
Users upvote, but never see that it moved a challenge score, a leaderboard position, or anything else. Connecting the two ("your meme is now #3 in this challenge") is what makes the scoring engine feel real rather than decorative. Folds naturally into §3.1.

---

## 4. The roadmap

Ordering principle: cheapest-highest-impact first; riskiest design last, after the most learning. Estimates are rough and assume the current single-developer cadence.

### Phase 17 — Optimistic interactions ("AJAX") · ✅ **SHIPPED 2026-08-06** · frontend only
**Goal:** nothing the user touches ever reloads, reshuffles, or blanks out.

Delivered: `services/optimisticCache.ts` (shared in-place patcher — see `.claude/memory/optimistic-cache.md`), all four interaction mutations converted, `VotePill` no longer blanks the score. `tsc` clean · `expo lint` 0 errors · jest **51/51** (16 new) · `expo export --platform web` clean. One extra correctness fix found during the work: `cancelQueries` must skip the paginated feed prefix or an in-flight `fetchNextPage` gets aborted and infinite scroll silently dies. **Not yet human tap-through tested.**

- Shared cache-patch helper in `services/` — applies a vote/count delta across every `['memes']` infinite cache, single-meme cache, and container cache.
- `useCastVoteMutation`: `onMutate` (cancel → snapshot → patch) / `onError` (rollback) / `onSettled` (**no feed invalidation**). Handle all vote transitions including toggles and flips (±2).
- Same treatment for `useAddCommentMutation` and the container vote/comment hooks in `useInstagram.ts`.
- `VotePill`: never replace the score with a spinner — keep the number, dim it.
- Tests (required for `services/` per frontend/CLAUDE.md): optimistic apply, rollback on error, no refetch on settle.

**Done when:** voting anywhere in the app changes only the number, and the feed does not move.

### Phase 18 — Challenge-aware creator + live scoreboard + Compete tab · ✅ **SHIPPED 2026-08-07**
**Goal:** a user can find a challenge and enter it in two taps, and can see whether they're winning. No new challenge shapes yet.

Frontend delivered 2026-08-07 (backend was already done). One simplification from the original scope: no `sideId` param on the creator — the flat create-and-submit endpoint resolves the caller's side server-side for every challenge shape, so "challengeId/sideId" became just "challengeId." `tsc`/`expo lint` clean, `expo export --platform web` clean (24 routes). See `.claude/memory/challenges.md`'s "Phase 18 + 20 frontend" section.

Backend
- Populate `ChallengeSideOut.score` from the existing `_side_score` on the read path.
- `GET /challenges/mine` — every challenge the caller is eligible for or competing in, across all communities, with status, `end_time`, and side scores.
- **`POST /challenges/{id}/submissions/create`** (multipart) — create the meme, attach the required community audience, and submit, in one transaction.

Frontend
- `/compete` route, segmented [Challenges | Leaderboards]; move leaderboards under it; swap the nav slot.
- Challenges tab sections: **Active** (countdown + live side scores), **Open to join**, **Results**.
- Creator accepts `challengeId`/`sideId` → persistent "Competing in *X* for *Y*" banner → publish calls the combined endpoint.
- Challenge detail: countdown, live scoreboard, **"Create a meme for this challenge"** as the primary CTA; `SubmissionPicker` demoted to a secondary "submit something you already posted."
- First-run explainer on the Challenges tab.

**Done when:** a member can go feed → Compete → challenge → create → published-and-submitted without leaving the flow, and can watch the score move.

### Phase 19 — Conversation inbox with text messaging · ✅ **SHIPPED 2026-08-06**
**Goal:** the inbox becomes a real messaging surface.

Delivered as specified — `Conversation` + `Message(kind: text|meme)` with `meme_sends` migrated in and dropped, the five `/messaging` endpoints, `message_received`/`message_read` WS frames, conversation list + thread + composer + new-chat picker. See `.claude/memory/messaging.md` (replaced `meme-sending.md`). Backend 18/18 pytest against real Postgres · migration verified both directions on real data · `tsc` clean · `expo lint` 0 errors · jest **67/67** (16 new) · `expo export --platform web` clean. **Not yet human tap-through tested.**

Decisions taken inside the phase: read receipts **in**, typing indicators **deferred** (open question 5); the shared per-user WebSocket **stayed at `/meme-sending/ws`** since it's the connection that's shared, not the feature; and old reactions were migrated into text messages rather than dropped.

Backend
- `Conversation` (participants, `last_message_at`) + `Message` (`conversation_id`, `sender_id`, `kind: text|meme`, `body`, `meme_id`, `read_at`). Migrate `meme_sends` into it.
- Endpoints: list conversations (last message + unread count), thread history (keyset-paginated), send message, mark read.
- WS frames: `message_received`, `message_read`. Typing indicators optional — defer unless cheap.
- Preserve the accepted-friendship gate. **Resolve meme attachments via `get_visible_meme`** (§2.4) and port the IDOR regression test.
- Keep `/meme-sending/send` as a thin shim so the feed's "↗ Send" button doesn't break mid-migration.

Frontend
- `/inbox` → conversation list (avatar, name, last-message preview, unread badge, timestamp).
- `/inbox/[conversationId]` → thread with paginated history + composer (text + attach meme).
- "New chat" → friend picker (reuse `useFriendsList`).

**Done when:** two users can hold a text conversation with memes inline, and history persists.

### Phase 20 — Open challenges + hashtags + duels · ✅ **SHIPPED 2026-08-07**

> **Built out of order** — Phase 19 (chat) was implemented in a separate session, so Phase 20's backend was brought forward to avoid colliding with it; the frontend followed a session later, alongside Phase 18's. Duels (§3.4) were **not built here** — they shipped in Phase 21 instead, once the notification system existed to deliver the invite.
**Goal:** anyone can challenge anyone; posting with a tag enters you.

Frontend delivered 2026-08-07: creator `#` autocomplete + required side-picker chip (`HashtagInput`), `/tag/[slug]` feed, and a `CreateOpenChallengeScreen` (not an explicit roadmap bullet — added because `POST /challenges/open` otherwise had no frontend entry point at all). One resolved design question: the autocomplete's side-picker doesn't post through `POST /memes`'s `hashtags` field — no backend path makes a plain personal post also create a `ChallengeSubmission`, so picking a side there routes through `join_open_challenge` + `create_and_submit_to_challenge`, the same endpoints the explicit "Create a meme for this challenge" CTA uses. See `.claude/memory/hashtags.md` and `.claude/memory/challenges.md`.

- `Hashtag` model (unique normalized slug) + `Meme.hashtags` M2M.
- `challenge_type: open`; challenge reserves a unique tag; self-join path on `ChallengeParticipant`.
- Creator: `#` autocomplete → resolving a challenge tag surfaces the **required side-picker chip** (§2.3). Unresolved tags stay plain discovery tags.
- **Anti-gaming in `_side_score`: per-user top-N cap + breadth weighting.** Non-negotiable — ships in this phase, not after.
- `/tag/[slug]` hashtag feed — this is the discovery surface that makes open challenges spread.
- Visible rejection when a `MemeContainer` carries a challenge tag (§3.5).

**Done when:** a user with no community can create a tagged open challenge, a stranger can join it by posting, and mass-posting does not win it.

### Phase 21 — Notifications + cold start (+ 1v1 duels) · ✅ **SHIPPED 2026-08-06**

Delivered as scoped, plus **1v1 duels** (§3.4) pulled forward from Phase 20: the "challenge-invite" notification needed a real invite event to fire on, and Phase 20's own note said to decide the duel mechanism once Phase 19 (chat) landed — it had. Duels turned out to need almost no new machinery: a fourth `ChallengeType.duel` reuses the existing participant-roster scoring/submission/evaluation path (`intra_community`'s shape) completely unchanged; the only new code is the propose/accept/decline flow itself, gated on the invitee rather than a community owner, with the invite delivered as a push/in-app notification instead of a chat message — reusing the vs-challenge propose/accept pattern exactly as Phase 20's note suggested, no chat coupling needed.

Backend 223/223 pytest against real Postgres. Frontend `tsc`/`expo lint` clean, `expo export --platform web` clean (21 routes), jest 76/76 (9 new). See `.claude/memory/notifications.md` (new) and `.claude/memory/challenges.md`'s Phase 21 section.

- arq-scheduled: challenge starting (event-driven, not cron), ending in 1h, side overtaken, results published; plus new-message (push-only, no in-app row — conversations already have their own unread surface) and challenge-invite pushes (duel invite/accept/decline + vs-challenge proposal/accept/decline).
- Expo push (raw `httpx` call to Expo's API, no SDK dependency) + in-app notification centre (`/notifications`, bell badge on the feed screen).
- Platform-run weekly open challenge (seeded system account, idempotent via deterministic per-ISO-week hashtag) so Compete is never empty (§3.3).
- **Duel frontend is a minimal, self-contained slice** (`DuelDetailScreen` + a flat `/challenges/[challengeId]` route, entry point on the friends list) — **not** the full Phase 18 Compete-tab rebuild, which remains a frontend leftover for a later pass.

Resolves open question 4 below: duels award the existing `Badge`/`challenge_winner` primitive, same as every other challenge shape — no separate win/loss record was built.

---

## 5. Suggested sequencing summary

```
17 Optimistic voting        ▓▓                          ~2d   ✅ shipped
18 Challenge-aware creator  ▓▓▓▓▓▓▓                     ~1w   ✅ shipped
19 Chat inbox               ▓▓▓▓▓▓▓▓▓▓                  ~1.5w ✅ shipped
20 Open challenges/hashtags ▓▓▓▓▓▓▓▓▓▓▓▓                ~2w   ✅ shipped
21 Notifications/cold start ▓▓▓▓                        ~5d   ✅ shipped, includes duels (see §4)
```

---

## 6. Spec decisions these changes reverse — must be updated in the same changesets

Two of these changes contradict written, deliberate decisions. Updating the docs is part of the work, not follow-up:

1. **`Project_Requirements.md` §11** — "reactions-only replies (**no full chat**)" and `frontend/CLAUDE.md`'s matching line. Phase 19 reverses this. Both files need updating, plus a Decisions Log (§17) entry recording that the review overrode it and why.
2. **`Project_Requirements.md` §10** — challenges are currently defined as *community* challenges throughout, owner-created. Phase 20 adds a platform-level open shape and self-service creation. §10 needs a new subsection (10.4 Open challenges), and §16's MVP framing needs to move challenges from "Enhanced" toward core.
3. **`.claude/memory/`** — `challenges.md`, `meme-sending.md`, `meme-feed.md`, and `scoring-engine.md` all describe current behaviour that these phases change. Per root `CLAUDE.md`, each must be updated **in the same changeset** as the code.

---

## 7. Open questions

1. **Open-challenge moderation.** Anyone can create a public challenge with a reserved tag. Who can delete an abusive one, and what happens to memes already submitted to it? Needs an answer before Phase 20 ships, not after.
2. **Per-user contribution cap value.** Proposed *N* = 3. Worth tuning once there is real data; the value should be a module constant like the other scoring tunables, not inlined.
3. **Do open-challenge results feed the community leaderboard?** Currently `community_vs_community` results flow into community standing via the `PostAudience` row. An open challenge has no community, so its memes contribute only to *individual* score. Confirm that is intended.
4. ~~**Duel stakes.**~~ — **settled in Phase 21**: duels award the existing `Badge`/`challenge_winner` primitive, same as every other challenge shape — no separate win/loss record.
5. ~~**Typing indicators / read receipts in chat**~~ — **settled in Phase 19**: read receipts shipped (`read_at` per message, `message_read` frame, "Sent"/"Read" on own bubbles); typing indicators deferred as not worth new WS traffic yet.
