# UX Principles — the opinionated house doctrine

What "good" means for this product specifically. Use these to *decide*, not to list options. When two
principles collide, the one higher in this file wins.

---

## 1. This is a meme app. Failure states are content, not apology screens.

The product's whole promise is fast, funny, effortless. A grey "Something went wrong." is a tonal
failure as much as a functional one — it is the moment the app stops feeling like a meme app.

The bar: **every state a user can land in should feel like it was designed by the same person who
designed the happy path.** An empty community feed, a lost connection, a challenge you just missed —
each is a real moment in the product and deserves real copy, real art direction, and a real next step.

That does not mean jokes everywhere. A failed upload of a meme the user spent 10 minutes on is not the
place to be funny. Calibrate: **playful when the stakes are low, plain and fast when the user has lost
something.**

## 2. The user's work is sacred.

Rank every finding partly by "how much effort does the user lose?" A failed vote costs a tap. A failed
publish costs a photo pick, a caption, three text overlays, a template choice, and an audience
decision. Those are not the same severity even though both are "a mutation failed."

Rules that follow:
- Never clear a form, a draft, or a composed document on failure.
- Never replace already-loaded content with an error because a *background refetch* failed.
- Anything long enough to fail (upload, publish, AI caption) needs its input preserved and a retry
  that does not restart the flow from step one.
- If work can be lost, the guard belongs *before* the loss, not as an apology after.

## 3. Never show a user a message written for a developer.

A LAN IP, an env var name, a stack, an endpoint path, a Pydantic validation string, a raw exception —
all disqualifying. The test: read the message aloud as if to someone who has never heard the word
"backend." If it fails, it is a P1 minimum.

The correct shape is three layers:
1. **What happened**, in their terms ("Your meme didn't post.")
2. **What they can do**, as a control, not a sentence (a Retry button).
3. **Optional detail**, collapsed, for the rare user who wants it.

The backend's own `detail` messages are usually already user-appropriate — they were written as
product copy. Transport-level fallbacks never are. Distinguishing those two is one line of work and
it fixes the whole app.

## 4. Every dead end is a bug.

A screen state with no forward action is a defect regardless of how correct it is. Empty list with no
CTA, error with no retry, "you must be a member" with no join button, a 403 you cannot resolve, a
notification that opens a deleted thing. Always ask: **from here, what can they tap?**

## 5. Optimistic by default, honest on reconcile.

This app already made the right call: patch the cache, never invalidate a feed. Extend that instinct.

- Any action whose success is near-certain (vote, join, follow, react) should apply instantly.
- The rollback path must be designed, not merely implemented — the user needs to know something
  reverted, and today there is nowhere for that message to appear.
- When the server disagrees with the optimistic guess (someone else voted in between), do not just
  snap the number. A visible jump with no explanation reads as a bug.

## 6. Match the guard to the damage — in both directions.

Over-guarding is as much a finding as under-guarding. A confirm dialog on a reversible action trains
users to dismiss dialogs, which is how the irreversible one gets dismissed too.

| Damage | Right guard |
|---|---|
| Reversible, instant (vote, react) | None. Just do it. |
| Reversible, slow (leave a community you can rejoin) | Undo affordance after the fact |
| Irreversible, low stakes (delete a comment) | Undo window, not a dialog |
| Irreversible, high stakes (delete a meme, pick a challenge side, block) | Explicit confirm naming the consequence |

This app currently has no undo affordance at all, which pushes everything toward modal confirms.
That is a systemic finding worth raising once per audit where it bites, not a per-button complaint.

## 7. Empty is a first impression, not an absence.

Every empty state is one of four things (see the Void lens) and the four need different copy. The
default in this repo is one grey sentence for all of them. The most valuable single upgrade to this
app's UX is making empties do their job: **explain what goes here, and offer the action that fills
it.** An empty community feed is the highest-intent moment a new member will ever have.

## 8. Time-bounded features must show their clock.

Challenges and competitions live and die on a window. A user who cannot see how long is left cannot
participate well, and a user who submits 3 seconds after close deserves an explanation, not a 400.

- Show remaining time wherever the window matters, and make it tick.
- Design the transition, not just the two states — a challenge going from active to evaluated while
  the user is on screen is a moment, and moments are where this product earns retention.
- Never show an action the server will reject. If the window closed, the button changes; it does not
  fail on tap.

## 9. Social features have a second user. Audit both.

For every feature, name the other person and ask what they experience. The submitter and the person
whose meme was beaten. The blocker and the blocked. The inviter and the invitee who never answered.
The friend who sent a meme to someone who has blocked them and does not know.

Corollary: **a harassment vector is always P0.** A surface that exposes a user with no block or report
path is not a polish issue.

## 10. Speed is a feature, and perceived speed is most of it.

Content-heavy social products are judged on the first 400ms. Layout shift on arrival, a spinner where
the content will be, and a flash of empty state before data lands all read as slowness even when the
network was fast. Skeletons that match the final layout are worth more here than most micro-copy.

## 11. Consistency beats local optimization.

A better button that only exists on one screen makes the app worse. Before recommending anything new,
check `components/`, `components/web/`, and `design-system/meme-platform/MASTER.md` for the existing
answer, and recommend extending it. "Use `GlassCard` / `PillButton` / `VotePill` here" is a better
recommendation than any new component. If a genuinely new pattern is needed, say explicitly that it is
new and where else it should later apply.

Repo-specific consistency rules worth remembering: `▲▼ VotePill` exclusively, never hearts/likes.
No `dark:` NativeWind variants — CSS variables. No raw hex in components. `bg-primary-container`, not
`bg-primary`, behind white text.

## 12. Accessibility is correctness, not polish.

A vote button with no `accessibilityState` does not announce whether the user voted — that is wrong
output, not missing decoration. Contrast failures are wrong rendering. Meaning carried only by color
fails for a meaningful slice of a mass-market social audience. File these as P1, not P2, when they
break comprehension rather than merely convenience.

---

## Severity model

Assign the severity honestly; inflation destroys the ranking's usefulness.

**P0 — ship-blocker.** Any one of: user work is lost; wrong or another user's data is shown; a state
with no way out; a failure the user cannot perceive; a harassment or privacy vector; a documented
invariant is broken (feed reorder, thread scroll jump, visibility leak).

**P1 — erodes trust.** The user cannot tell what happened or why; a common real path is confusing or
broken; a developer-facing message reaches a user; an action that will be rejected is still offered;
accessibility that breaks comprehension.

**P2 — polish.** A measurable improvement to clarity, speed, delight, or consistency, where nothing is
actually incorrect.

Two tie-breakers: **frequency** (a daily path beats a rare one at equal severity) and **effort lost**
(principle 2).

---

## House style for the report

- Lead with the failure, not the fix. "Publish loses the entire draft on a timeout" before "add a
  retry."
- One concrete trigger per finding, with real values. "Tap upvote three times in under a second," not
  "rapid interaction."
- Cite the file and line. It is the difference between an audit and an opinion.
- The **Why** line is about the user or the business, never the mechanism. "The user just lost ten
  minutes of work and has no idea why" — not "because the mutation does not preserve state."
- No hedging. "Consider possibly adding" is not a recommendation. Say what to do.
- Name what is already right. It protects good decisions from being refactored away later, and it is
  the cheapest way to make the rest of the audit credible.
