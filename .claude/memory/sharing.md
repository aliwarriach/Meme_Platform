# sharing

## Status
Done (Phase 14, frontend-only — no backend work, this feature has no server-side surface). `tsc`/`expo lint`/`expo export --platform web` all clean (17 routes, unchanged). No human tap-through yet — this is a native-module feature (`expo-sharing`, `expo-file-system`), so web export passing is not a real functional test; needs a real Android/iOS device or simulator per `frontend/CLAUDE.md`'s native-module testing rule.

## Scope decision (2026-07-23)
`Project_Requirements.md` §12 says "export as image/video," but **no video meme pipeline exists anywhere in this codebase** (`Meme` model is image-only — `image_url`/`image_public_id`, no video fields; no upload/storage path for video). Confirmed with user: **image-only for this phase** — video export is N/A until a video meme feature actually exists elsewhere first, not built speculatively here.

## Models / Endpoints
None. Pure frontend — shares the *already-published* remote Cloudinary image URL a meme already has (`meme.image_url`), no new backend contract.

## Business rules
- Native share sheet, not a custom in-app share modal — per `frontend/CLAUDE.md`'s explicit "never a custom share modal" rule. Uses `expo-sharing`'s `shareAsync`, which opens the OS's own share sheet; WhatsApp/Instagram/X etc. appear as targets automatically because the OS resolves apps capable of handling `image/*`, not because this app hardcodes a target list.
- **Cloudinary URLs are remote, but `expo-sharing`/most target apps need a local file URI** — `shareMemeImage()` (`features/sharing/shareMeme.ts`) downloads the image to the OS cache directory first (`expo-file-system`'s new SDK-57 `File`/`Paths` API: `File.downloadFileAsync(url, Paths.cache)`), then shares that local file's `.uri`. No manual cleanup of the cache file — `Paths.cache` is explicitly documented as OS-reclaimable storage.
- Two distinct failure modes surfaced separately: `ShareUnavailableError` (device/simulator has no share capability — checked via `Sharing.isAvailableAsync()` before attempting anything) and `ShareDownloadError` (network/download failure fetching the remote image). `MemeCard` shows either as inline text under the action row, same pattern as the existing vote-error handling — never a crash/unhandled rejection.
- "Export as image" (saving locally, not just sharing to another app) is satisfied by the same share sheet, since both Android's and iOS's native share sheets include a "Save Image"/"Save to Photos" target — no separate save-to-gallery button or `expo-media-library` dependency was added, since that would duplicate what the OS sheet already offers for free.

## Frontend integration notes
- `features/sharing/shareMeme.ts` — the only file in this feature; no service/query hook needed since there's no server round-trip to cache (TanStack Query doesn't apply to a one-shot native action with no cacheable server data).
- Wired directly into the existing `features/feed/components/MemeCard.tsx` — a new "⤴ Share" button next to the existing "↗ Send" button in the action row, with its own local `isSharing`/`shareError` `useState` (no Redux — this is single-component, transient UI state, consistent with "promote to Redux only on 2nd cross-component consumer").
- New dependencies: `expo-sharing` (~57.0.7), `expo-file-system` (~57.0.1) — both installed via `npx expo install` for SDK-57 compatibility. `expo-file-system`'s SDK 57 default export is the new `File`/`Directory`/`Paths` object-oriented API (not the older path-string-based `FileSystem.*` functions from earlier SDKs) — don't mix the two APIs if extending this later.

## Gotchas
- `expo-sharing` has limited/no-op behavior on web — `isAvailableAsync()` should return `false` there, which `shareMemeImage` already handles as `ShareUnavailableError` rather than crashing, but real functional verification of this feature requires an actual Android/iOS device or simulator, not `expo start --web`.

## Key files
- frontend: `src/features/sharing/shareMeme.ts`, `src/features/feed/components/MemeCard.tsx` (Share button + handler).

## Tests
- None added. Per `frontend/CLAUDE.md`, `services/`-layer logic normally gets tests, but this feature has no `services/` file (no server round-trip, no cacheable query) — the one function it does have (`shareMemeImage`) is a thin wrapper directly calling two native Expo module APIs (`Sharing.shareAsync`, `File.downloadFileAsync`), which would require mocking native modules to test meaningfully; real verification is the device tap-through, not a unit test, consistent with "not required for pure presentational components" extended to thin native-module wrappers with no branching business logic beyond try/catch.
