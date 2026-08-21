import { Redirect } from 'expo-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSelector } from 'react-redux';

import { ensureWebFontsReady } from '@/features/creator/skiaFonts';
import type { RootState } from '@/store/store';
import { ensureSkiaWebReady } from '@/utils/skiaWeb';

// Web-only variant of this route (Metro/Expo Router pick this over `new-post.tsx` for web
// builds). Lazy-loading `CreatorScreen` isn't just a startup-cost optimization here — it's the
// only import path that pulls in `@shopify/react-native-skia`, and that package's web `Skia`
// object must not be evaluated before CanvasKit is loaded (see `utils/skiaWeb.web.ts` for why:
// `Skia.Image` freezes as `undefined` forever if that happens). A static top-level import would
// run before `ensureSkiaWebReady()` below ever gets a chance to resolve.
const CreatorScreen = lazy(() => import('@/features/creator/CreatorScreen'));

function CreatorLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator color="#ff3385" />
    </View>
  );
}

export default function NewPost() {
  const token = useSelector((state: RootState) => state.auth.token);
  const [skiaReady, setSkiaReady] = useState(false);

  useEffect(() => {
    if (skiaReady) return;
    // Sequential, not Promise.all: `ensureWebFontsReady` dynamically imports `Skia` itself
    // (see skiaFonts.web.ts) and must not do so until `ensureSkiaWebReady` has already set
    // `global.CanvasKit` — running them concurrently would race the same undefined-freeze bug.
    ensureSkiaWebReady()
      .then(() => ensureWebFontsReady())
      .then(() => setSkiaReady(true));
  }, [skiaReady]);

  if (!token) return <Redirect href="/login" />;
  if (!skiaReady) return <CreatorLoading />;

  return (
    <Suspense fallback={<CreatorLoading />}>
      <CreatorScreen />
    </Suspense>
  );
}
