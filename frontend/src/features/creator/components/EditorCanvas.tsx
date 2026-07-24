import { Canvas, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';

import { aspectRatio, clamp01, getSelectedLayer } from '@/features/creator/document';
import {
  buildMemeLayers,
  exportMeme,
  type ImageCache,
  layerBBox,
  MemeScene,
  staticLayerTransform,
  type SceneLayer,
} from '@/features/creator/skiaMeme';
import {
  selectDocument,
  selectLayer,
  setSelectedPosition,
  setSelectedRotation,
  setSelectedScale,
} from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

export interface EditorCanvasHandle {
  // Flattens the current document to a PNG (canvas aspect, longer side 1080) and returns
  // its file URI.
  export: () => Promise<string>;
}

async function loadSkImage(uri: string): Promise<SkImage | null> {
  try {
    const data = await Skia.Data.fromURI(uri);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null;
  }
}

// Skia-rendered multi-layer meme editor (text + image + emoji-sticker layers) on an
// aspect-ratio-aware canvas. The document is the source of truth in Redux; the selected
// layer's transform is mirrored into absolute shared values so move/scale/rotate run on
// the UI thread and commit one undoable entry on release. Image layers are decoded once
// into a uri→SkImage cache used by both the preview and the export.
export const EditorCanvas = forwardRef<EditorCanvasHandle>((_props, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const doc = useSelector(selectDocument);
  const image = useImage(doc.baseImageUri);
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const [images, setImages] = useState<ImageCache>(new Map());

  const ratio = aspectRatio(doc.canvas.aspectId);

  const imageUris = doc.layers.flatMap((l) => (l.kind === 'image' ? [l.uri] : []));
  const imageUriKey = imageUris.join('|');
  useEffect(() => {
    let cancelled = false;
    const missing = imageUris.filter((uri) => !images.has(uri));
    if (missing.length === 0) return;
    Promise.all(missing.map(async (uri) => [uri, await loadSkImage(uri)] as const)).then((pairs) => {
      if (cancelled) return;
      setImages((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [uri, img] of pairs) {
          if (img && !next.has(uri)) {
            next.set(uri, img);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUriKey]);

  const built = useMemo(() => buildMemeLayers(doc, canvas, images), [doc, canvas, images]);

  const selId = doc.selectedId;
  const selLayer = getSelectedLayer(doc);
  const selBuilt = built.find((b) => b.id === selId);
  const hasSelection = !!selBuilt;

  // Absolute live transform of the selected layer, seeded from the doc and re-synced
  // whenever selection or the layer's transform changes (commit / undo / redo). The
  // numeric deps mean this never fires mid-gesture.
  const livePosX = useSharedValue(0.5);
  const livePosY = useSharedValue(0.5);
  const liveScale = useSharedValue(1);
  const liveRotation = useSharedValue(0);

  useEffect(() => {
    if (!selLayer) return;
    livePosX.value = selLayer.pos.x;
    livePosY.value = selLayer.pos.y;
    liveScale.value = selLayer.scale;
    liveRotation.value = selLayer.rotation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, selLayer?.pos.x, selLayer?.pos.y, selLayer?.scale, selLayer?.rotation]);

  // Geometry of the selected layer captured for the live transform worklet. `builtScale`
  // is the scale the payload was measured at, so a live pinch scales by liveScale/built
  // (visual only) until release rebuilds it at the new size.
  const g = selBuilt
    ? { w: canvas.w, h: canvas.h, anchorX: selBuilt.anchorX, height: selBuilt.height, builtScale: selBuilt.layer.scale }
    : null;

  const selectedTransform = useDerivedValue(() => {
    if (!g) return [];
    const factor = liveScale.value / g.builtScale;
    return [
      { translateX: livePosX.value * g.w },
      { translateY: livePosY.value * g.h },
      { rotate: liveRotation.value },
      { scale: factor },
      { translateX: -g.anchorX },
      { translateY: -g.height / 2 },
    ];
  });

  const sceneLayers: SceneLayer[] = built.map((b) => ({
    id: b.id,
    fill: b.fill,
    stroke: b.stroke,
    image: b.image,
    transform: b.id === selId ? selectedTransform : staticLayerTransform(b, canvas),
    drawWidth: b.drawWidth,
    anchorX: b.anchorX,
    contentWidth: b.contentWidth,
    height: b.height,
  }));

  const onSelect = useCallback((id: string | null) => dispatch(selectLayer(id)), [dispatch]);
  const commitPosition = useCallback(
    (x: number, y: number) => dispatch(setSelectedPosition({ x, y })),
    [dispatch]
  );
  const commitScale = useCallback((v: number) => dispatch(setSelectedScale(v)), [dispatch]);
  const commitRotation = useCallback((v: number) => dispatch(setSelectedRotation(v)), [dispatch]);

  // Plain-number hit boxes captured by the tap worklet — topmost layer wins.
  const hitAreas = built.map((b) => ({ id: b.id, ...layerBBox(b, canvas) }));
  const { w, h } = canvas;

  const tap = Gesture.Tap().onEnd((e, success) => {
    'worklet';
    if (!success) return;
    let hit: string | null = null;
    for (let i = hitAreas.length - 1; i >= 0; i -= 1) {
      const a = hitAreas[i];
      const dx = e.x - a.cx;
      const dy = e.y - a.cy;
      const cos = Math.cos(-a.rot);
      const sin = Math.sin(-a.rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= a.hw + 14 && Math.abs(ly) <= a.hh + 14) {
        hit = a.id;
        break;
      }
    }
    runOnJS(onSelect)(hit);
  });

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startX.value = livePosX.value;
      startY.value = livePosY.value;
    })
    .onChange((e) => {
      'worklet';
      if (!hasSelection || w === 0 || h === 0) return;
      livePosX.value = clamp01(startX.value + e.translationX / w);
      livePosY.value = clamp01(startY.value + e.translationY / h);
    })
    .onEnd(() => {
      'worklet';
      if (!hasSelection) return;
      runOnJS(commitPosition)(livePosX.value, livePosY.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      startScale.value = liveScale.value;
    })
    .onChange((e) => {
      'worklet';
      if (!hasSelection) return;
      liveScale.value = startScale.value * e.scale;
    })
    .onEnd(() => {
      'worklet';
      if (!hasSelection) return;
      runOnJS(commitScale)(liveScale.value);
    });

  const rotation = Gesture.Rotation()
    .onBegin(() => {
      'worklet';
      startRotation.value = liveRotation.value;
    })
    .onChange((e) => {
      'worklet';
      if (!hasSelection) return;
      liveRotation.value = startRotation.value + e.rotation;
    })
    .onEnd(() => {
      'worklet';
      if (!hasSelection) return;
      runOnJS(commitRotation)(liveRotation.value);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, rotation, tap);

  useImperativeHandle(
    ref,
    () => ({
      export: async () => {
        if (!image) throw new Error('Image is still loading.');
        // Guarantee every image layer is decoded before the snapshot, so none are missing
        // from the export.
        const map: ImageCache = new Map(images);
        const missing = doc.layers
          .flatMap((l) => (l.kind === 'image' ? [l.uri] : []))
          .filter((uri) => !map.has(uri));
        await Promise.all(
          missing.map(async (uri) => {
            const img = await loadSkImage(uri);
            if (img) map.set(uri, img);
          })
        );
        return exportMeme({ image, doc, images: map });
      },
    }),
    [image, doc, images]
  );

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setCanvas({ w: width, h: height });
      }}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: 12, overflow: 'hidden' }}
      className="bg-black">
      {w > 0 && h > 0 && image ? (
        <GestureDetector gesture={gesture}>
          <Canvas style={{ width: w, height: h }}>
            <MemeScene
              image={image}
              canvas={canvas}
              fit={doc.canvas.fit}
              bg={doc.canvas.bg}
              layers={sceneLayers}
              selectedId={selId}
            />
          </Canvas>
        </GestureDetector>
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" />
        </View>
      )}
    </View>
  );
});
EditorCanvas.displayName = 'EditorCanvas';
