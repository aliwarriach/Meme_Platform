import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { Oswald_700Bold } from '@expo-google-fonts/oswald';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';
import { RobotoSlab_700Bold } from '@expo-google-fonts/roboto-slab';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';

/**
 * CanvasKit (react-native-skia's web backend) has no access to OS-installed fonts — every
 * `fontFamilies` name used by `Skia.ParagraphBuilder.Make` on web must be backed by font
 * bytes registered on an explicit `SkTypefaceFontProvider`, or it throws "SkTypefaceFontProvider
 * is required on React Native Web." (see JsiSkParagraphBuilderFactory.ts). Native has no such
 * requirement — it resolves the `document.ts` `FONT_OPTIONS` system family names (e.g.
 * `sans-serif-black`) through the platform's own font manager.
 *
 * Each meme text style maps to a real Google Fonts family (pre-bolded weight files, since
 * `buildParagraph` always requests `FontWeight.Bold`) bundled via `@expo-google-fonts/*`
 * packages — the same require()-an-asset-module pattern already used for the UI's
 * BeVietnamPro font in `app/_layout.tsx`.
 *
 * `Skia` itself is imported dynamically inside `ensureWebFontsReady`, never at this module's
 * top level. This file is imported eagerly from `app/new-post.web.tsx` (a route registered at
 * the app root, so its top-level imports evaluate at initial page load even before that route
 * is visited — see `skiaWeb.web.ts`). The web `Skia` object is computed once, at the moment its
 * own module is evaluated, from whatever `global.CanvasKit` happens to be at that instant; if
 * that happened here it would freeze permanently undefined, since `ensureSkiaWebReady()`
 * (which sets `global.CanvasKit`) hasn't necessarily run yet. Deferring the import into the
 * async function body means it only evaluates when `ensureWebFontsReady()` is actually called
 * — callers MUST await `ensureSkiaWebReady()` first (see `new-post.web.tsx`).
 */
const WEB_FONT_SOURCES: Record<string, { module: number; family: string }> = {
  impact: { module: Anton_400Regular, family: 'Meme-Impact' },
  condensed: { module: Oswald_700Bold, family: 'Meme-Condensed' },
  classic: { module: BeVietnamPro_700Bold, family: 'Meme-Classic' },
  serif: { module: RobotoSlab_700Bold, family: 'Meme-Serif' },
  mono: { module: RobotoMono_700Bold, family: 'Meme-Mono' },
  script: { module: Pacifico_400Regular, family: 'Meme-Script' },
};

const DEFAULT_FAMILY = WEB_FONT_SOURCES.classic.family;

let resolvedProvider: SkTypefaceFontProvider | null = null;
let readyPromise: Promise<void> | null = null;

export function webFontFamily(fontId: string): string {
  return WEB_FONT_SOURCES[fontId]?.family ?? DEFAULT_FAMILY;
}

export function getWebFontProvider(): SkTypefaceFontProvider | null {
  return resolvedProvider;
}

export function ensureWebFontsReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const { Skia } = await import('@shopify/react-native-skia');
      const provider = Skia.TypefaceFontProvider.Make();
      await Promise.all(
        Object.values(WEB_FONT_SOURCES).map(async ({ module, family }) => {
          const asset = Asset.fromModule(module);
          await asset.downloadAsync();
          const response = await fetch(asset.localUri ?? asset.uri);
          const bytes = new Uint8Array(await response.arrayBuffer());
          const data = Skia.Data.fromBytes(bytes);
          const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
          if (typeface) provider.registerFont(typeface, family);
        })
      );
      resolvedProvider = provider;
    })();
  }
  return readyPromise;
}
