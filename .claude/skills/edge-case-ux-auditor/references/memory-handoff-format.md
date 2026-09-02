# Memory Handoff Format — emit, never write

**This skill never writes to any memory file.** Not `.claude/memory/*`, not `MEMORY.md`, not
`design-system/*`, not a roadmap. An audit is an opinion until a human accepts it; writing it into the
project's source of truth would let unreviewed judgment calls harden into fact, and stale or wrong
memory is worse than none.

What you do instead: **emit a paste-ready block** and say exactly where it goes. The user pastes it,
or asks you in a separate turn — outside this skill — to apply it.

## When to emit

Only in these three cases. Otherwise the audit report itself is the deliverable and no block is needed.

1. **The user asks** to save, record, or remember the audit.
2. **A finding contradicts a memory file** — the file claims something the code no longer does. That
   is a staleness bug in the project's source of truth, and it outlives this conversation.
3. **A P0 will not be fixed now.** A known, accepted, unfixed defect is exactly what memory files are
   for; the next session should not rediscover it.

Never emit for P2 polish, and never emit a wishlist. Memory records what is *true*, not what would
be nice.

## Format A — appending to an existing feature memory file

Matches the house format in `.claude/memory/README.md`: bullets, short, no code listings, no
restatement of anything a `CLAUDE.md` already says. Date every entry — the files are read
chronologically by future sessions.

```markdown
## Known UX gaps (audit YYYY-MM-DD, not yet fixed)
- **<one-line defect>** — <the concrete trigger>. Today: <what the code does, `file.tsx:line`>.
  <Consequence for the user.> Severity: P0 | P1.
- ...
```

If the finding is a **staleness correction** rather than a gap, it belongs in the file's existing
prose, not a new section — emit the corrected sentence and name the line it replaces:

```markdown
REPLACES the line reading "<old claim>" in .claude/memory/<feature>.md:
- <corrected claim, with the file:line that proves it>  (verified YYYY-MM-DD)
```

## Format B — a new cross-cutting note

Only when the finding genuinely spans features and belongs to no single one. Follow the same house
template, and link related files with `[[feature-name]]` as the existing memory files do.

```markdown
# <slug>

## Status
Audit finding, unfixed as of YYYY-MM-DD. Not implemented — this file records the gap, not a plan.

## What
<2-4 bullets.>

## Why it matters
<1-2 bullets: user consequence.>

## Where it bites
- `<file>:<line>` — <how it manifests there>
- ...

## Related
[[meme-feed]] [[optimistic-cache]]
```

Plus the one-line index entry, stated separately so the user can paste it into
`.claude/memory/README.md`'s Index section:

```markdown
- [<slug>.md](<slug>.md) — <hook, one clause>.
```

## Rules for anything you emit

- **Anchored.** Every claim carries a `file:line`, a memory-file rule, or a backend contract. No
  claim in a memory file should ever need re-derivation to be trusted.
- **Dated**, absolute, never relative ("2026-08-30", never "today" or "last week").
- **Present tense about the code, past tense about the audit.** The file describes what is true now.
- **No fixes, no diffs, no proposed code.** Memory records the gap; the roadmap records the plan.
- **Nothing already stated** in a `CLAUDE.md`, in the code's own structure, or in git history.
- Keep it to what a future session would be worse off not knowing.

## What to say when you emit

One line, no ceremony:

> Paste-ready for `.claude/memory/<feature>.md` (append under Status, or after the Gotchas section).
> I have not written it — say the word if you want it applied.
