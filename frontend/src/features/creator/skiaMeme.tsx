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

import {
  alignedCenterX,
  BASE_FONT_FRACTION,
  type CanvasFit,
  type CanvasPx,
  canvasPixels,
  EXPORT_MAX_SIDE,
  IMAGE_BASE_FRACTION,
  resolveFontFamilies,
  type Layer,
  type MemeDocument,
  type TextAlignId,
  type TextLayer,
} from '@/features/creator/document';

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
function buildParagraph(layer: TextLayer, width: number, stroke: boolean): SkParagraph {
  const fontSize = width * BASE_FONT_FRACTION * layer.scale;
  const { style } = layer;

  const textStyle: SkTextStyle = {
    fontFamilies: resolveFontFamilies(style.fontId),
    fontSize,
    fontStyle: { weight: FontWeight.Bold },
    color: Skia.Color(stroke ? style.strokeColor : style.color),
  };
  if (!stroke && style.shadow) {
    textStyle.shadows = [
      { color: Skia.Color('black'), offset: { x: fontSize * 0.05, y: fontSize * 0.05 }, blurRadius: fontSize * 0.06 },
    ];
  }

  const builder = Skia.ParagraphBuilder.Make({ textAlign: SKIA_ALIGN[style.align], maxLines: 8 });
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

// Builds the drawable + measured geometry for every renderable layer at the given canvas
// size. Text layers with no content and image layers whose image isn't decoded yet are
// skipped. Widths/fonts are based on canvas.w; canvas.h only matters for y-placement.
export function buildMemeLayers(doc: MemeDocument, canvas: CanvasPx, images: ImageCache): BuiltLayer[] {
  return doc.layers.flatMap<BuiltLayer>((layer) => {
    if (layer.kind === 'text') {
      if (layer.text.trim().length === 0) return [];
      const fill = buildParagraph(layer, canvas.w, false);
      const stroke = layer.style.strokeWidthFraction > 0 ? buildParagraph(layer, canvas.w, true) : null;
      const longestLine = fill.getLongestLine();
      return [
        {
          id: layer.id,
          layer,
          fill,
          stroke,
          image: null,
          drawWidth: canvas.w,
          anchorX: alignedCenterX(layer.style.align, canvas.w, longestLine),
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

// Oriented bounding box of a layer in canvas pixels — used for tap hit-testing.
export function layerBBox(built: BuiltLayer, canvas: CanvasPx) {
  return {
    cx: built.layer.pos.x * canvas.w,
    cy: built.layer.pos.y * canvas.h,
    hw: built.contentWidth / 2,
    hh: built.height / 2,
    rot: built.layer.rotation,
  };
}

export interface SceneLayer {
  id: string;
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
          {layer.id === selectedId ? (
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

// Flattens the document to a PNG on disk at the canvas's export resolution (longer side =
// EXPORT_MAX_SIDE) and returns its file URI. Renders the exact MemeScene the user edited
// (selection chrome off), with all image layers already decoded in `images`.
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
  const file = new File(Paths.cache, `meme-${Date.now()}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}
