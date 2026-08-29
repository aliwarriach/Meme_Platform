import { Canvas, Group, Rect, RoundedRect, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';

import {
  aspectRatio,
  clamp01,
  clampScale,
  getSelectedLayer,
  isTextLayer,
  MIN_BOX_HEIGHT_FRACTION,
  MIN_BOX_WIDTH_FRACTION,
  SCALE_STEP,
} from '@/features/creator/document';
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
  setSelectedBox,
  setSelectedPosition,
  setSelectedRotation,
  setSelectedScale,
} from '@/store/creatorDraftSlice';
import type { AppDispatch } from '@/store/store';

// Resize-handle geometry, in on-screen preview px (not canvas-normalized — purely a UI
// choice, never exported). Long capsules laid along the edge they sit on: left/right
// handles run vertically, top/bottom run horizontally. The hit radius is padded well past
// the visible pill for an easy one-thumb grab.
const HANDLE_PILL_LEN = 26;
const HANDLE_PILL_THICK = 10;
const HANDLE_HIT_RADIUS = 28;

type DragMode = 'move' | 'left' | 'right' | 'top' | 'bottom';

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
  // Live half-width/half-height (canvas px) of the selected text layer's box, driving the
  // resize-handle overlay in real time. Seeded from the layer's explicit box when set, or
  // from its current natural content size otherwise — so the first handle drag starts
  // exactly where the text already visually sits, no jump.
  const liveBoxHalfW = useSharedValue(0);
  const liveBoxHalfH = useSharedValue(0);

  const selTextBoxW = selLayer && isTextLayer(selLayer) ? selLayer.box?.width : undefined;
  const selTextBoxH = selLayer && isTextLayer(selLayer) ? selLayer.box?.height : undefined;

  useEffect(() => {
    if (!selLayer) return;
    livePosX.value = selLayer.pos.x;
    livePosY.value = selLayer.pos.y;
    liveScale.value = selLayer.scale;
    liveRotation.value = selLayer.rotation;
    if (isTextLayer(selLayer) && selBuilt) {
      liveBoxHalfW.value = selLayer.box ? (selLayer.box.width * canvas.w) / 2 : selBuilt.contentWidth / 2;
      liveBoxHalfH.value = selLayer.box ? (selLayer.box.height * canvas.h) / 2 : selBuilt.height / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, selLayer?.pos.x, selLayer?.pos.y, selLayer?.scale, selLayer?.rotation, selTextBoxW, selTextBoxH, canvas.w, canvas.h]);

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
    kind: b.layer.kind,
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
  const commitBox = useCallback(
    (x: number, y: number, width: number, height: number) =>
      dispatch(setSelectedBox({ pos: { x, y }, box: { width, height } })),
    [dispatch]
  );

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
  const startHalfW = useSharedValue(0);
  const startHalfH = useSharedValue(0);
  const dragMode = useSharedValue<DragMode>('move');

  // Where the selected text layer's 4 resize handles currently sit, in canvas px — a plain
  // object recomputed each render (same pattern as `hitAreas`/`g` below) and closed over by
  // the worklets, so `onBegin`'s hit test always sees the latest box/position/rotation.
  const selIsText = !!selLayer && isTextLayer(selLayer);
  const handleGeom =
    selIsText && selLayer && selBuilt
      ? {
          cx: selLayer.pos.x * w,
          cy: selLayer.pos.y * h,
          rot: selLayer.rotation,
          halfW: selLayer.box ? (selLayer.box.width * w) / 2 : selBuilt.contentWidth / 2,
          halfH: selLayer.box ? (selLayer.box.height * h) / 2 : selBuilt.height / 2,
        }
      : null;
  const minHalfW = (MIN_BOX_WIDTH_FRACTION * w) / 2;
  const minHalfH = (MIN_BOX_HEIGHT_FRACTION * h) / 2;

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      startX.value = livePosX.value;
      startY.value = livePosY.value;
      startHalfW.value = liveBoxHalfW.value;
      startHalfH.value = liveBoxHalfH.value;
      dragMode.value = 'move';
      if (handleGeom) {
        const dx = e.x - handleGeom.cx;
        const dy = e.y - handleGeom.cy;
        const cos = Math.cos(-handleGeom.rot);
        const sin = Math.sin(-handleGeom.rot);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (Math.abs(lx - handleGeom.halfW) < HANDLE_HIT_RADIUS && Math.abs(ly) < HANDLE_HIT_RADIUS) {
          dragMode.value = 'right';
        } else if (Math.abs(lx + handleGeom.halfW) < HANDLE_HIT_RADIUS && Math.abs(ly) < HANDLE_HIT_RADIUS) {
          dragMode.value = 'left';
        } else if (Math.abs(ly - handleGeom.halfH) < HANDLE_HIT_RADIUS && Math.abs(lx) < HANDLE_HIT_RADIUS) {
          dragMode.value = 'bottom';
        } else if (Math.abs(ly + handleGeom.halfH) < HANDLE_HIT_RADIUS && Math.abs(lx) < HANDLE_HIT_RADIUS) {
          dragMode.value = 'top';
        }
      }
    })
    .onChange((e) => {
      'worklet';
      if (!hasSelection || w === 0 || h === 0) return;
      if (dragMode.value === 'move') {
        livePosX.value = clamp01(startX.value + e.translationX / w);
        livePosY.value = clamp01(startY.value + e.translationY / h);
        return;
      }
      if (!handleGeom) return;
      // Edge-anchored resize: only the dragged edge moves, so the box's center shifts by
      // half the drag and the dragged dimension's half-extent grows/shrinks by the other
      // half — see setSelectedBox's comment for why both dimensions commit together.
      const rot = handleGeom.rot;
      const ldx = e.translationX * Math.cos(rot) + e.translationY * Math.sin(rot);
      const ldy = -e.translationX * Math.sin(rot) + e.translationY * Math.cos(rot);
      let dHw = 0;
      let dHh = 0;
      let dCxLocal = 0;
      let dCyLocal = 0;
      if (dragMode.value === 'right') {
        dHw = ldx / 2;
        dCxLocal = ldx / 2;
      } else if (dragMode.value === 'left') {
        dHw = -ldx / 2;
        dCxLocal = ldx / 2;
      } else if (dragMode.value === 'bottom') {
        dHh = ldy / 2;
        dCyLocal = ldy / 2;
      } else if (dragMode.value === 'top') {
        dHh = -ldy / 2;
        dCyLocal = ldy / 2;
      }
      liveBoxHalfW.value = Math.max(minHalfW, startHalfW.value + dHw);
      liveBoxHalfH.value = Math.max(minHalfH, startHalfH.value + dHh);
      const dCx = dCxLocal * Math.cos(rot) - dCyLocal * Math.sin(rot);
      const dCy = dCxLocal * Math.sin(rot) + dCyLocal * Math.cos(rot);
      livePosX.value = clamp01(startX.value + dCx / w);
      livePosY.value = clamp01(startY.value + dCy / h);
    })
    .onEnd(() => {
      'worklet';
      if (!hasSelection) return;
      if (dragMode.value === 'move') {
        runOnJS(commitPosition)(livePosX.value, livePosY.value);
      } else {
        runOnJS(commitBox)(livePosX.value, livePosY.value, (liveBoxHalfW.value * 2) / w, (liveBoxHalfH.value * 2) / h);
      }
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

  // Box-overlay geometry for the selected text layer: a Group positioned/rotated the same
  // way as the box itself (centered on `pos`, no anchor shift needed since the box IS
  // centered there by construction), with the outline + 4 handle pills driven by the live
  // half-extent shared values so they track the resize gesture at 60fps without re-running
  // the (comparatively expensive) paragraph rebuild until the drag commits on release.
  const handlesTransform = useDerivedValue(() => [
    { translateX: livePosX.value * canvas.w },
    { translateY: livePosY.value * canvas.h },
    { rotate: liveRotation.value },
  ]);
  const boxX = useDerivedValue(() => -liveBoxHalfW.value);
  const boxY = useDerivedValue(() => -liveBoxHalfH.value);
  const boxW = useDerivedValue(() => liveBoxHalfW.value * 2);
  const boxH = useDerivedValue(() => liveBoxHalfH.value * 2);
  const rightHandleX = useDerivedValue(() => liveBoxHalfW.value - HANDLE_PILL_THICK / 2);
  const leftHandleX = useDerivedValue(() => -liveBoxHalfW.value - HANDLE_PILL_THICK / 2);
  const topHandleY = useDerivedValue(() => -liveBoxHalfH.value - HANDLE_PILL_THICK / 2);
  const bottomHandleY = useDerivedValue(() => liveBoxHalfH.value - HANDLE_PILL_THICK / 2);
  const sideHandleY = -HANDLE_PILL_LEN / 2; // constant: box is vertically centered at 0
  const vertHandleX = -HANDLE_PILL_LEN / 2; // constant: box is horizontally centered at 0

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
            {selIsText ? (
              <Group transform={handlesTransform}>
                <Rect x={boxX} y={boxY} width={boxW} height={boxH} color="#F97316" style="stroke" strokeWidth={1.5} />
                <RoundedRect x={rightHandleX} y={sideHandleY} width={HANDLE_PILL_THICK} height={HANDLE_PILL_LEN} r={HANDLE_PILL_THICK / 2} color="#F97316" />
                <RoundedRect x={leftHandleX} y={sideHandleY} width={HANDLE_PILL_THICK} height={HANDLE_PILL_LEN} r={HANDLE_PILL_THICK / 2} color="#F97316" />
                <RoundedRect x={vertHandleX} y={topHandleY} width={HANDLE_PILL_LEN} height={HANDLE_PILL_THICK} r={HANDLE_PILL_THICK / 2} color="#F97316" />
                <RoundedRect x={vertHandleX} y={bottomHandleY} width={HANDLE_PILL_LEN} height={HANDLE_PILL_THICK} r={HANDLE_PILL_THICK / 2} color="#F97316" />
              </Group>
            ) : null}
          </Canvas>
        </GestureDetector>
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" />
        </View>
      )}

      {/* Floating so it's always reachable while dragging a layer near the bottom of the
          canvas, instead of requiring a scroll down to LayerInspector's old Size section. */}
      {hasSelection && selLayer ? (
        <View pointerEvents="box-none" className="absolute right-2 top-2 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease size"
            onPress={() => dispatch(setSelectedScale(clampScale(selLayer.scale / SCALE_STEP)))}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-outline-variant bg-surface/90">
            <Text className="font-title text-lg text-heading">A−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase size"
            onPress={() => dispatch(setSelectedScale(clampScale(selLayer.scale * SCALE_STEP)))}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-outline-variant bg-surface/90">
            <Text className="font-title text-xl text-heading">A+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});
EditorCanvas.displayName = 'EditorCanvas';
