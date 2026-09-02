import {
  drawAsImage,
  Fill,
  FontWeight,
  Group,
  ImageFormat,
  Image as SkiaImage,
  Paragraph,
  PaintStyle,
  Rect,
  Skia,
  StrokeJoin,
  TextAlign,
  type SkImage,
  type SkParagraph,
  type SkTextStyle,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import {
  alignedCenterX,
  BASE_FONT_FRACTION,
  type CanvasFit,
  type CanvasPx,
  canvasPixels,
  EXPORT_MAX_SIDE,
  IMAGE_BASE_FRACTION,
  MIN_AUTOFIT_SCALE,
  resolveFontFamilies,
  type Layer,
  type MemeDocument,
  type TextAlignId,
  type TextLayer,
} from '@/features/creator/document';
import { getWebFontProvider, webFontFamily } from '@/features/creator/skiaFonts';

// Group `transform` accepts a static array or a Reanimated shared value — deriving the
// type from the component keeps the animated preview and the static export both valid
// against the same MemeScene.
type TransformProp = ComponentProps<typeof Group>['transform'];

// Decoded images for image layers, keyed by uri. Loaded imperatively so both the preview
// and the offscreen export draw ready SkImages (a lazily-loaded image would be missing
// from the export snapshot).
export type ImageCache = Map<string, SkImage>;

const SKIA_ALIGN: Record<TextAlignId, TextAlign> = {
  left: TextAlign.Left,
  center: TextAlign.Center,
  right: TextAlign.Right,
};

export interface BuiltLayer {
  id: string;
  layer: Layer;
  fill: SkParagraph | null;
  stroke: SkParagraph | null; // null when a text layer has no outline
  image: SkImage | null; // set for image layers
  drawWidth: number; // width of the box the payload is painted into
  anchorX: number; // x of the payload's visual center within that box
  contentWidth: number; // visual width, for hit-testing
  height: number; // visual/block height
}

// Text sizing is based on canvas WIDTH so a layer keeps its look across aspect ratios.
// `fontSize` is always resolved by the caller (see `fitTextToBox`) rather than derived here
// from `width`, since `width` is now the layer's independent wrap width (its box, or the
// full canvas as a fallback) and must vary separately from font size.
function buildParagraph(layer: TextLayer, width: number, stroke: boolean, fontSize: number): SkParagraph {
  const { style } = layer;

  // CanvasKit (web) has no OS font manager — it only knows the families registered on the
  // provider built in `skiaFonts.web.ts`, not the Android system names `resolveFontFamilies`
  // returns for native.
  const fontFamilies =
    Platform.OS === 'web' ? [webFontFamily(style.fontId)] : resolveFontFamilies(style.fontId);
  const textStyle: SkTextStyle = {
    fontFamilies,
    fontSize,
    fontStyle: { weight: FontWeight.Bold },
    color: Skia.Color(stroke ? style.strokeColor : style.color),
  };
  if (!stroke && style.shadow) {
    textStyle.shadows = [
      { color: Skia.Color('black'), offset: { x: fontSize * 0.05, y: fontSize * 0.05 }, blurRadius: fontSize * 0.06 },
    ];
  }

  // Web's CanvasKit requires an explicit typeface provider (registered in `skiaFonts.web.ts`)
  // or throws "SkTypefaceFontProvider is required on React Native Web"; native resolves
  // `fontFamilies` through its own system font manager instead.
  //
  // The provider argument must be OMITTED on native, never passed as `undefined`: Make is a
  // JSI binding that branches on argument *count*, not value —
  //   `count > 1 ? JsiSkTypefaceFontProvider::fromValue(runtime, arguments[1]) : nullptr`
  // — so an explicit `undefined` makes it coerce undefined into an SkTypefaceFontProvider and
  // hard-crash the process (no JS error, app dies on the first text layer).
  const paragraphStyle = { textAlign: SKIA_ALIGN[style.align], maxLines: 8 };
  const fontProvider = Platform.OS === 'web' ? getWebFontProvider() : null;
  const builder = fontProvider
    ? Skia.ParagraphBuilder.Make(paragraphStyle, fontProvider)
    : Skia.ParagraphBuilder.Make(paragraphStyle);
  if (stroke) {
    const paint = Skia.Paint();
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(fontSize * style.strokeWidthFraction);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setColor(Skia.Color(style.strokeColor));
    paint.setAntiAlias(true);
    builder.pushStyle(textStyle, paint);
  } else {
    builder.pushStyle(textStyle);
  }
  builder.addText(layer.text);
  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

// Resolves a text layer's fill (+ optional stroke) paragraph at `layoutWidthPx`, shrinking
// the font from its normal scale-derived size (never below `MIN_AUTOFIT_SCALE` of it) when
// `boxHeightPx` is set and the text would otherwise overflow it — this is what makes
// closing the gap between the top/bottom resize handles pack words back onto the lines
// above instead of just clipping. `boxHeightPx` null (no explicit box yet) skips the fit
// entirely, matching the old, unconstrained-height behavior exactly.
function fitTextToBox(
  layer: TextLayer,
  layoutWidthPx: number,
  boxHeightPx: number | null,
  canvasWidthPx: number
): { fill: SkParagraph; stroke: SkParagraph | null; fontSize: number } {
  const targetFontSize = canvasWidthPx * BASE_FONT_FRACTION * layer.scale;
  let fontSize = targetFontSize;
  let fill = buildParagraph(layer, layoutWidthPx, false, fontSize);

  if (boxHeightPx != null && fill.getHeight() > boxHeightPx) {
    const minFont = targetFontSize * MIN_AUTOFIT_SCALE;
    let lo = minFont;
    let hi = targetFontSize;
    let best = minFont;
    let bestFill = buildParagraph(layer, layoutWidthPx, false, minFont);
    if (bestFill.getHeight() <= boxHeightPx) {
      // Binary search for the largest font size (down from target, above the floor) whose
      // wrapped height still fits — a handful of paragraph rebuilds, only paid when the box
      // actually constrains this layer.
      for (let i = 0; i < 6; i += 1) {
        const mid = (lo + hi) / 2;
        const candidate = buildParagraph(layer, layoutWidthPx, false, mid);
        if (candidate.getHeight() <= boxHeightPx) {
          lo = mid;
          best = mid;
          bestFill = candidate;
        } else {
          hi = mid;
        }
      }
    }
    // If even the floor size overflows, fall back to it anyway (the box is too small for
    // this text) rather than leaving the font at its untouched, worse-overflowing target size.
    fontSize = best;
    fill = bestFill;
  }

  const stroke = layer.style.strokeWidthFraction > 0 ? buildParagraph(layer, layoutWidthPx, true, fontSize) : null;
  return { fill, stroke, fontSize };
}

// Builds the drawable + measured geometry for every renderable layer at the given canvas
// size. Text layers with no content and image layers whose image isn't decoded yet are
// skipped. Widths/fonts are based on canvas.w; canvas.h only matters for y-placement.
export function buildMemeLayers(doc: MemeDocument, canvas: CanvasPx, images: ImageCache): BuiltLayer[] {
  return doc.layers.flatMap<BuiltLayer>((layer) => {
    if (layer.kind === 'text') {
      if (layer.text.trim().length === 0) return [];
      const layoutWidthPx = (layer.box?.width ?? 1) * canvas.w;
      const boxHeightPx = layer.box ? layer.box.height * canvas.h : null;
      const { fill, stroke } = fitTextToBox(layer, layoutWidthPx, boxHeightPx, canvas.w);
      const longestLine = fill.getLongestLine();
      return [
        {
          id: layer.id,
          layer,
          fill,
          stroke,
          image: null,
          drawWidth: layoutWidthPx,
          anchorX: alignedCenterX(layer.style.align, layoutWidthPx, longestLine),
          contentWidth: longestLine,
          height: fill.getHeight(),
        },
      ];
    }
    const image = images.get(layer.uri);
    if (!image) return [];
    const aspect = image.width() / image.height();
    const width = canvas.w * IMAGE_BASE_FRACTION * layer.scale;
    const height = width / aspect;
    return [
      {
        id: layer.id,
        layer,
        fill: null,
        stroke: null,
        image,
        drawWidth: width,
        anchorX: width / 2,
        contentWidth: width,
        height,
      },
    ];
  });
}

// Static transform placing a layer's centered payload at its normalized position (x of
// canvas width, y of height), rotated about its own center. The payload is painted from
// the box origin; we shift its visual center (anchorX, height/2) to the origin so
// rotation/scale pivot on it, then out to pos.
export function staticLayerTransform(built: BuiltLayer, canvas: CanvasPx): TransformProp {
  return [
    { translateX: built.layer.pos.x * canvas.w },
    { translateY: built.layer.pos.y * canvas.h },
    { rotate: built.layer.rotation },
    { translateX: -built.anchorX },
    { translateY: -built.height / 2 },
  ];
}

// Oriented bounding box of a layer in canvas pixels — used for tap hit-testing. A text
// layer with an explicit resize box hit-tests against the box (so tapping anywhere inside
// it, not just on glyph pixels, selects it) rather than the tighter content-hugging bounds.
export function layerBBox(built: BuiltLayer, canvas: CanvasPx) {
  const box = built.layer.kind === 'text' ? built.layer.box : undefined;
  return {
    cx: built.layer.pos.x * canvas.w,
    cy: built.layer.pos.y * canvas.h,
    hw: box ? (box.width * canvas.w) / 2 : built.contentWidth / 2,
    hh: box ? (box.height * canvas.h) / 2 : built.height / 2,
    rot: built.layer.rotation,
  };
}

export interface SceneLayer {
  id: string;
  kind: Layer['kind'];
  fill: SkParagraph | null;
  stroke: SkParagraph | null;
  image: SkImage | null;
  transform: TransformProp;
  drawWidth: number;
  anchorX: number;
  contentWidth: number;
  height: number;
}

interface MemeSceneProps {
  image: SkImage; // base image
  canvas: CanvasPx;
  fit: CanvasFit; // how the base image fills the frame
  bg: string; // letterbox / background color
  layers: SceneLayer[];
  selectedId: string | null; // draws a selection outline; pass null for export
}

// The single scene rendered both inside the on-screen <Canvas> and inside drawAsImage's
// offscreen surface. `fit=contain` letterboxes with `bg`; `fit=cover` fills + center-crops.
export function MemeScene({ image, canvas, fit, bg, layers, selectedId }: MemeSceneProps) {
  return (
    <>
      <Fill color={bg} />
      <SkiaImage image={image} x={0} y={0} width={canvas.w} height={canvas.h} fit={fit} />
      {layers.map((layer) => (
        <Group key={layer.id} transform={layer.transform}>
          {layer.image ? (
            <SkiaImage
              image={layer.image}
              x={0}
              y={0}
              width={layer.drawWidth}
              height={layer.height}
              fit="fill"
            />
          ) : (
            <>
              {layer.stroke ? (
                <Paragraph paragraph={layer.stroke} x={0} y={0} width={layer.drawWidth} />
              ) : null}
              {layer.fill ? (
                <Paragraph paragraph={layer.fill} x={0} y={0} width={layer.drawWidth} />
              ) : null}
            </>
          )}
          {/* Text layers get the box + resize-handle overlay drawn by EditorCanvas instead —
              this content-hugging rect stays only for image layers, which have no box. */}
          {layer.id === selectedId && layer.kind !== 'text' ? (
            <Rect
              x={layer.anchorX - layer.contentWidth / 2}
              y={-4}
              width={layer.contentWidth}
              height={layer.height + 8}
              color="#F97316"
              style="stroke"
              strokeWidth={2}
            />
          ) : null}
        </Group>
      ))}
    </>
  );
}

function toSceneLayers(built: BuiltLayer[], canvas: CanvasPx): SceneLayer[] {
  return built.map((b) => ({
    id: b.id,
    kind: b.layer.kind,
    fill: b.fill,
    stroke: b.stroke,
    image: b.image,
    transform: staticLayerTransform(b, canvas),
    drawWidth: b.drawWidth,
    anchorX: b.anchorX,
    contentWidth: b.contentWidth,
    height: b.height,
  }));
}

// Flattens the document to a PNG at the canvas's export resolution (longer side =
// EXPORT_MAX_SIDE) and returns a URI for it — a `file://` path on native, a `blob:` URL on
// web (expo-file-system's `File`/`Paths` are unimplemented stubs there; see ExpoFileSystem.web.ts
// — every method throws or no-ops past the constructor). Both URI kinds are directly usable by
// `<Image source={{uri}}>` and by `fetch()` in `multipartImage.ts`'s web upload path. Renders
// the exact MemeScene the user edited (selection chrome off), with all image layers already
// decoded in `images`.
export async function exportMeme(params: {
  image: SkImage;
  doc: MemeDocument;
  images: ImageCache;
}): Promise<string> {
  const { image, doc, images } = params;
  const canvas = canvasPixels(doc.canvas.aspectId, EXPORT_MAX_SIDE);
  const layers = toSceneLayers(buildMemeLayers(doc, canvas, images), canvas);

  const snapshot = await drawAsImage(
    <MemeScene
      image={image}
      canvas={canvas}
      fit={doc.canvas.fit}
      bg={doc.canvas.bg}
      layers={layers}
      selectedId={null}
    />,
    { width: canvas.w, height: canvas.h }
  );
  if (!snapshot) throw new Error('Could not render the meme.');

  const bytes = snapshot.encodeToBytes(ImageFormat.PNG, 100);

  if (Platform.OS === 'web') {
    // `Uint8Array<ArrayBufferLike>` (encodeToBytes' return type) isn't assignable to
    // `BlobPart` as-is; copying through the array-like constructor overload narrows it to
    // `Uint8Array<ArrayBuffer>`, which is.
    return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
  }

  const file = new File(Paths.cache, `meme-${Date.now()}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}
