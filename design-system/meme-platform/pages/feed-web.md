# Feed Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-07 (hand-authored — see "Why hand-authored" below)
> **Page Type:** Desktop/web-only pilot screen — `frontend/src/features/feed/FeedScreen.web.tsx`
> **Mode:** GREENFIELD MODE, explicit new-visual-identity request. This is the PILOT screen for
> a new "Dark Cinema" system — **not yet propagated anywhere else.**

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md`,
> and apply **only** to the web-only feed tree (`FeedScreen.web.tsx`, `components/web/Web*.tsx`
> listed below, `constants/webFeedTheme.ts`). MASTER.md's "Vivid Meme Culture" system is
> untouched and still governs every native screen and every other web route (which currently
> falls back to `DesktopShell`'s shared old-token chrome — see Known seams below).

---

## Why hand-authored, not `--persist --page`

`design_system.py::persist_design_system` gates page-file creation behind the **same**
MASTER.md-exists check as the master write itself (verified by reading the source directly,
`scripts/design_system.py:751-782`): if `MASTER.md` already exists and `--force` isn't passed,
the function returns `status: "skipped_exists"` and **never reaches the page-write branch at
all** — even though `--page` was passed. Since this task explicitly forbids `--force` (MASTER.md
must stay byte-for-byte untouched), the tool could not write this file. Confirmed by actually
running it first:

```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "cinematic dark indigo glassmorphism premium streaming desktop feed" --design-system --persist -p "Meme Platform" --output-dir "C:\Users\Newuser\Desktop\Meme_Platform" --page "feed-web"
```
→ printed the full design-system recommendation (captured below) then:
```
⚠️  ...MASTER.md already exists and was not modified. Read it first...
```
No file was written by that command. Everything below is transcribed by hand from the **raw
query output actually returned** (shown in full in "Reconciliation" below) — nothing here was
invented from memory.

---

## Reconciliation — multi-query convergence (RESKIN's "Generating the new system" discipline)

Per this agent's own rule (never trust a single `--design-system` roll — it's non-deterministic
and blends in the `landing` domain), five split-domain queries were run, 2-3 phrasings per
domain, and only what **converged across independent runs** was kept:

**Style** (`--domain style -n 5`, 3 phrasings: "desktop web social feed dark mode entertainment
meme culture" / "vibrant gen-z streaming twitch discord dark immersive feed" / "content dense
masonry feed desktop dashboard entertainment"):
- Query 1 and Query 2 (2/2) both independently surfaced **"Dark Mode (OLED)"** (deep black/dark
  grey, minimal glow, WCAG AAA) and **"Modern Dark (Cinema Mobile)"** (near-black gradient,
  glassmorphism cards, indigo accent `#5E6AD2`, ambient depth, `borderRadius: 16`, "media/
  streaming platforms") as top-3 results. Query 3 (masonry/dashboard phrasing) returned
  unrelated BI-dashboard results — discarded, not a match for this product.
- **Kept:** near-black/very-dark base + frosted-glass card surfaces + indigo accent glow +
  cinematic depth. This is the "Dark Cinema" family name used throughout this file.

**Color** (`--domain color -n 5`, 2 phrasings): "cinematic dark indigo glassmorphism premium
streaming desktop feed" and "dark mode deep black neon accent vibrant streaming feed".
- Both queries returned dark-indigo-on-near-black rows (Sleep Tracker `#4338CA`/`#0F172A`;
  Music Streaming `#1E1B4B`/`#0F0F23`/`#22C55E`; Video Streaming/OTT `#0F0F23`/`#000000`/
  `#E11D48`). **`Muted Foreground: #94A3B8` appeared identically in every single row across
  both queries** — highest-confidence token in the whole set.
- The separate `--design-system` auto-roll (below) **independently landed on the exact same
  "Music Streaming" row** (`Primary #1E1B4B`, `Secondary #4338CA`, `Accent #22C55E`,
  `Background #0F0F23`, `Foreground #F8FAFC`, `Muted #27273B`, `Border #312E81`,
  `Destructive #EF4444`) as a direct `--domain color` query — a genuine second-source
  convergence, not a coincidence of the same non-deterministic tool being asked twice. **This
  became the base palette.**

**Typography** (`--domain typography -n 5`, 2 phrasings): "modern geometric sans display bold
entertainment dashboard" (returned Righteous/Poppins, Russo One/Chakra Petch — bold-display
gaming/entertainment pairings, not a fit) and "premium dark app clean readable sans typography
desktop" (top hit: **"Modern Dark Cinema (Inter System)"** — mood keywords literally "dark,
cinematic, technical, precision, clean, premium... streaming platforms", i.e. an exact-name
match for the style-domain convergence above). The blended `--design-system` roll (below)
**also** returned `Inter / Inter` independently. **2/2 convergence, single dominant family —
Inter.**

**`--design-system` auto-roll** (query: "cinematic dark indigo glassmorphism premium streaming
desktop feed", `-p "Meme Platform"`, run once for cross-check per the instructed discipline —
not trusted alone):
```
STYLE: Liquid Glass (flowing glass, translucent, animated blur, chromatic aberration;
  Light+Dark full support; Best for: Premium SaaS, luxury portfolios)
COLORS: Primary #1E1B4B / Secondary #4338CA / Accent #22C55E / Background #0F0F23 /
  Foreground #F8FAFC / Muted #27273B / Border #312E81 / Destructive #EF4444
TYPOGRAPHY: Inter / Inter — Google Fonts:
  https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
PATTERN: Storytelling + Feature-Rich (Hero/Features/CTA) — a landing-page pattern, per the
  skill's own DOMAIN GOTCHA. Discarded — this is an in-app feed, not a marketing page.
CHECKLIST: cursor-pointer, hover transitions, 375/768/1024/1440 breakpoints — web-flavored,
  informed this file's own responsive notes below rather than being copied verbatim.
```
The roll's colors/typography exactly match the split-query convergence above (a third
confirmation for the palette, second for typography). Its "Liquid Glass" style label and
"translucent/blur" language are the reason card surfaces below use alpha-derived glass
(`rgba(...)`) rather than flat fills — the technique is directly named in the skill output,
not invented.

**Net conclusion:** "Dark Cinema" — near-black indigo gradient canvas, translucent glass card
surfaces, indigo brand/structural accent, single dominant Inter type family, emerald/rose
engagement accents. This is a **deliberate divergence** from MASTER.md's shipped neon-pink/
purple/green "Vivid Meme Culture" — expected and intended per this task's explicit "new visual
identity" ask; it is NOT a contradiction to reconcile, since it's scoped to a page override, not
a MASTER.md change, and native is completely unaffected.

---

## Page-Specific Rules

### Layout Overrides
- **Structure:** `DesktopShell` (untouched, shared) supplies the persistent left sidebar nav at
  ≥900px and the feed-route content column (1040px max). This page's own content fills that
  column: a flexible feed list (left) + a fixed 380px always-open inbox rail (right,
  `components/web/WebFeedRail.tsx`) at ≥900px; single full-width column with `FloatingBottomNav`
  (existing shared component, self-hides at ≥900px, reused unmodified) below 900px.
- **Card width:** feed column is `flex: 1` inside the shell's content box (~660px at the 1040px
  cap) — no additional max-width clamp; the card itself reads correctly across that range.
- **Breakpoint:** this repo has no committed desktop breakpoint set (per frontend/CLAUDE.md:54,
  which predates the web shell). This page reuses `DESKTOP_FRAME_MIN_WIDTH` (900px, from
  `constants/webLayout.ts`) as its own single breakpoint, matching `DesktopShell`'s own — so the
  rail appears exactly when the sidebar does, not at a mismatched width.

### Spacing Overrides
- 4/8/12/16/20/24px scale (`constants/webFeedTheme.ts`'s `FEED_WEB_SPACING`) — same numeric
  family as MASTER's Tailwind 4px scale, just sourced from a plain JS object instead of
  NativeWind classNames (per this task's explicit ban on NativeWind color/type tokens for new
  web-only code; pure-structural utility classes were avoidable entirely here since layout is
  simple enough for inline `StyleSheet`).

### Typography Overrides
- **Family:** Inter (see Reconciliation) — NOT MASTER's Be Vietnam Pro. Loaded via a
  `<link>` injected once into `<head>` (`webFeedTheme.ts::injectFeedWebFont`), full URL copied
  verbatim from the skill's raw (non-truncated) output — never hand-typed.
- **Scale** (`FEED_WEB_TYPE`): display 28/700 (brand wordmark only) · h2 18/600 (rail header) ·
  title 15/600 (card author name) · body 15/400 (caption) · meta 12.5/400 (timestamps, counts) ·
  label 11/500 uppercase +1.2 tracking (unused on this pass, reserved) · voteScore 14/700.
  Derived from "Modern Dark Cinema (Inter System)"'s documented scale (Display 48/H1 32/H2 24/
  body 16), scaled down for card-density use rather than a separately invented scale.

### Color Overrides (full palette — see `webFeedTheme.ts::FEED_WEB_COLORS` for the single
source of truth; do not hand-copy hexes elsewhere, import the constants)
| Role | Value | Source |
|---|---|---|
| Page gradient | `#1E1B4B → #0F0F23 → #000000` | Primary/Background/alt-Background, all literal grounded rows |
| Card surface (glass) | `rgba(27,27,48,0.55)` | Card `#1B1B30` (Music Streaming row) + alpha |
| Card surface (solid fallback) | `#1B1B30` | Music Streaming row, exact |
| Elevated surface | `#27273B` | Muted token, exact |
| Border | `rgba(49,46,129,0.55)` | Border `#312E81`, alpha-derived |
| Indigo primary (structural) | `#1E1B4B` | exact |
| Indigo secondary (glow/hover) | `#4338CA` | exact |
| Upvote accent | `#22C55E` | Accent, exact — "play/positive green" |
| Downvote / error accent | `#EF4444` | Destructive, exact |
| Foreground | `#F8FAFC` | exact |
| Foreground muted | `#94A3B8` | exact — appeared in every converged row |

### Shape / Effects Overrides
- Card radius 20px, pill controls 999px (kept — the ▲▼ vote pill's pill shape is a
  **cross-screen interaction-pattern convention**, not a color/style opinion; MASTER.md's
  Component Conventions + Anti-Patterns both call out "never a heart/like icon, always the ▲▼
  pill" as an established pattern, so the shape carries over even though every color inside it
  is new).
- Glass surfaces are flat `rgba(...)` fills with a 1px hairline border, NOT `BlurView` —
  `expo-blur` is an existing dependency and its web target generally maps to CSS
  `backdrop-filter`, but MASTER.md flags a confirmed **Android** sizing bug with nested
  `BlurView` content; since this page is web-only, that specific bug doesn't apply, but a flat
  alpha fill was chosen anyway to keep this pilot's risk surface small and avoid introducing any
  new blur-related rendering variable this pass didn't need to test.
- No ambient animated "blob" layer from the Cinema Mobile reference — cut for scope/perf on a
  first web pilot; the three-stop gradient canvas alone delivers the same depth cue.

### Component Notes
- New standalone components only (none reuse MASTER's shared native components, all of which
  alias the old NativeWind token set): `WebAvatar`, `WebVotePill`, `WebMemeCard`,
  `WebContainerCard`, `WebMergedFeedList`, `WebFeedTopBar`, `WebFeedRail` — all under
  `frontend/src/components/web/`.
- Nested modals (`SendMemeModal`, `ShareInstagramLinkModal`, and the expandable
  `CommentsSection`/`ContainerCommentsSection`) are **reused as-is**, unreskinned — they're
  native-resolved shared files, out of bounds for this pass. This is a deliberate, stated scope
  boundary, not an oversight: reskinning every nested modal would multiply this pilot's blast
  radius well past "one screen." Flagged as a known visual seam below.

---

## Known seams (accepted, out of scope for this pilot)

- `DesktopShell`/`DesktopSidebarNav` (app-wide shared chrome, mounted in `app/_layout.tsx`) still
  render in MASTER's old palette (`#1e0f13` background, `#372529` borders) — the sidebar and the
  content-column's left hairline border will visibly clash with this page's new indigo-black
  gradient. Reskinning shared app chrome is out of this pilot's mandate (that would propagate the
  new system app-wide before manual review, which the PILOT-SCREEN RULE explicitly forbids).
- `SendMemeModal` / `ShareInstagramLinkModal` / inline comment sections render in the old
  "Vivid Meme Culture" tokens when opened from this page — see Component Notes above.

---

## Next steps (do not do this automatically)

This page is the pilot only. Do not propagate "Dark Cinema" to any other screen or promote it
into MASTER.md until a human has reviewed the rendered result and explicitly approved the
direction.
