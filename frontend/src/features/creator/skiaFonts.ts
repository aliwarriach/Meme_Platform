import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

/**
 * Native default: react-native-skia resolves `fontFamilies` (system font names like
 * `sans-serif-black`) via the platform's own font manager, so there's no provider to build.
 * See `skiaFonts.web.ts` for the real web implementation — Metro picks that file instead for
 * web builds via the `.web.ts` extension. Same exports as that file so `tsc` (which doesn't
 * do Metro's platform-suffix resolution) type-checks callers against either one.
 */
export function ensureWebFontsReady(): Promise<void> {
  return Promise.resolve();
}

export function webFontFamily(_fontId: string): string {
  return '';
}

export function getWebFontProvider(): SkTypefaceFontProvider | null {
  return null;
}
