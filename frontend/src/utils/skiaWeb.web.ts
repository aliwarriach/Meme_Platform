import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

let readyPromise: Promise<void> | null = null;

/**
 * `@shopify/react-native-skia`'s web `Skia` object is computed ONCE at module-evaluation time
 * from `global.CanvasKit` (see the package's `Skia.web.js`: `export const Skia =
 * JsiSkApi(global.CanvasKit)`). If that module is evaluated before `global.CanvasKit` exists,
 * `Skia.Image` (and friends) are permanently `undefined` for the rest of the page's lifetime —
 * calling `LoadSkiaWeb()` later does NOT retroactively fix the already-evaluated `Skia`
 * singleton. This is the exact cause of "Cannot read properties of undefined (reading
 * 'MakeImageFromEncoded')" when the meme creator loads on web.
 *
 * The fix has to stop the Skia package's module graph from ever being evaluated before
 * CanvasKit is ready — awaiting a promise inside the module that imports it is too late,
 * since ES module evaluation runs synchronously before any component code. So the creator
 * route (`app/new-post.tsx`) React.lazy()-imports `CreatorScreen` (which is what pulls in
 * `@shopify/react-native-skia` transitively) and only does so after this resolves — deferring
 * that module's first evaluation until CanvasKit is actually installed on `global.CanvasKit`.
 */
export function ensureSkiaWebReady(): Promise<void> {
  if (!readyPromise) readyPromise = LoadSkiaWeb();
  return readyPromise;
}
