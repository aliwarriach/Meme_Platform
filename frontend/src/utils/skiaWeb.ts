/**
 * Native default: `@shopify/react-native-skia` auto-initializes via its JSI native module on
 * iOS/Android, so there's nothing to wait for. See `skiaWeb.web.ts` for the real web
 * implementation — Metro picks that file instead for web builds via the `.web.ts` extension.
 */
export function ensureSkiaWebReady(): Promise<void> {
  return Promise.resolve();
}
