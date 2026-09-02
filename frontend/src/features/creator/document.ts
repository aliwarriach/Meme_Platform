// The creator's editable document — the single source of truth for the Skia canvas and
// the flattened export. Kept as plain, serializable data. All geometry is normalized
// (positions are 0..1 fractions of the canvas side; scale is a font multiplier; rotation
// is radians) so the same document renders identically in a ~360px preview and a 1080px
// export, and is directly reusable as template data later.
//
// This file is imported by `store/creatorDraftSlice.ts`, which loads at app startup (not
// behind the creator's lazy-load boundary) — it must never import `@shopify/react-native-skia`
// (directly or via `skiaFonts.web.ts`) or anything else that touches it. See `skiaWeb.web.ts`
// for why: the web `Skia` object is computed once at module-evaluation time and freezes
// undefined forever if evaluated before `LoadSkiaWeb()` runs. Web-specific font resolution
// lives in `skiaMeme.tsx` instead, which IS behind that boundary.

export type TextAlignId = 'left' | 'center' | 'right';

// Normalized *center* of a layer: x is a fraction of the canvas width, y of its height.
// Anchoring at the center (not a corner) is what lets a layer rotate and scale about
// itself, and normalizing keeps a layer's relative placement stable across aspect ratios.
export interface NormPos {
  x: number;
  y: number;
}

export interface TextStyleSpec {
  fontId: string; // key into FONT_OPTIONS; resolved to real font families at render time
  color: string;
  strokeColor: string;
  strokeWidthFraction: number; // outline thickness as a fraction of font size (0 = none)
  align: TextAlignId;
  shadow: boolean;
}

// A text layer's independent wrap-width / wrap-height box, in fractions of canvas w/h,
// centered on the layer's `pos`. Undefined until the user drags a resize handle — before
// that, text lays out exactly as it always has (full canvas width, no height cap besides
// `maxLines`), so existing/persisted layers render unchanged until touched. Once set, both
// dimensions are always written together (see `setSelectedBox`): width controls the wrap
// width directly, height caps it — text shrinks (see `MIN_AUTOFIT_SCALE`) to fit inside it.
export interface TextBox {
  width: number;
  height: number;
}

// Fields common to every layer kind — the transform the gesture/selection system
// operates on generically, regardless of what the layer draws.
interface BaseLayer {
  id: string;
  pos: NormPos; // normalized center
  scale: number; // size multiplier (1 = base)
  rotation: number; // radians
}

export interface TextLayer extends BaseLayer {
  kind: 'text';
  text: string; // an emoji sticker is just a text layer whose text is an emoji
  style: TextStyleSpec;
  box?: TextBox; // explicit wrap box, set the first time a resize handle is dragged
}

export interface ImageLayer extends BaseLayer {
  kind: 'image';
  uri: string; // decoded to an SkImage on demand; aspect derived from the image itself
}

export type Layer = TextLayer | ImageLayer;

export function isTextLayer(layer: Layer): layer is TextLayer {
  return layer.kind === 'text';
}

// --- Canvas (aspect ratio + how the base image fills it + letterbox color) ---

export type AspectId = 'square' | 'portrait' | 'story' | 'landscape' | 'classic';

// ratio = width / height. Labels/order match how a user picks a share target.
export const ASPECT_PRESETS: { id: AspectId; label: string; hint: string; ratio: number }[] = [
  { id: 'square', label: '1:1', hint: 'Square', ratio: 1 },
  { id: 'portrait', label: '4:5', hint: 'Insta post', ratio: 4 / 5 },
  { id: 'story', label: '9:16', hint: 'Story / Reel / TikTok', ratio: 9 / 16 },
  { id: 'landscape', label: '16:9', hint: 'Landscape', ratio: 16 / 9 },
  { id: 'classic', label: '3:4', hint: 'Classic', ratio: 3 / 4 },
];

// contain = fit whole image, letterbox with `bg`; cover = fill the frame, center-cropping
// the overflow (the lightweight "crop" until a drag-crop tool lands).
export type CanvasFit = 'contain' | 'cover';

export interface CanvasSpec {
  aspectId: AspectId;
  fit: CanvasFit;
  bg: string; // letterbox / background color
}

export interface CanvasPx {
  w: number;
  h: number;
}

export function aspectRatio(id: AspectId): number {
  return ASPECT_PRESETS.find((a) => a.id === id)?.ratio ?? 1;
}

// Canvas pixel size for a given aspect, with the longer side pinned to `maxSide`. Used for
// both the export resolution and (with the measured preview width) the on-screen size.
export function canvasPixels(id: AspectId, maxSide: number): CanvasPx {
  const ratio = aspectRatio(id);
  return ratio >= 1
    ? { w: maxSide, h: Math.round(maxSide / ratio) }
    : { w: Math.round(maxSide * ratio), h: maxSide };
}

export interface MemeDocument {
  baseImageUri: string | null;
  canvas: CanvasSpec;
  layers: Layer[]; // render order — last entry is topmost
  selectedId: string | null;
}

// Default width of an image layer as a fraction of the canvas side (before `scale`).
export const IMAGE_BASE_FRACTION = 0.55;

// Curated emoji set for the sticker picker — device color-emoji font renders them.
export const EMOJI_STICKERS = [
  '😂', '💀', '🔥', '😭', '😳', '🥶', '😎', '🤡', '👀', '💯',
  '🙏', '🤔', '😤', '👑', '⭐', '❤️', '💔', '✨', '⚡', '💥',
  '👍', '👎', '🤯', '🥵', '😴', '🤣', '😱', '🫡', '🤪', '😬',
  '🎉', '🚀', '🍆', '💩', '🐐', '🧠', '👉', '👈', '☠️', '🆒',
];

// Longest side of the exported image, in px — sets output quality. The preview renders
// the same document at whatever size it's laid out to.
export const EXPORT_MAX_SIDE = 1080;

// Base font size as a fraction of the canvas WIDTH, before a layer's `scale` multiplier.
export const BASE_FONT_FRACTION = 0.09;

export const SCALE_MIN = 0.3;
export const SCALE_MAX = 6;
export const SCALE_STEP = 1.15; // A-/A+ stepper factor

// Bounds for a text layer's explicit resize-handle box, as fractions of canvas w/h.
export const MIN_BOX_WIDTH_FRACTION = 0.12;
export const MAX_BOX_WIDTH_FRACTION = 2;
export const MIN_BOX_HEIGHT_FRACTION = 0.05;
export const MAX_BOX_HEIGHT_FRACTION = 2;

// When a box's height can't fit the text at the layer's normal (scale-derived) font size,
// the renderer shrinks the font — never below this fraction of that normal size — so
// closing the vertical gap between the top/bottom handles packs words back onto the lines
// above instead of just clipping.
export const MIN_AUTOFIT_SCALE = 0.25;

export function clampBoxWidth(value: number): number {
  return value < MIN_BOX_WIDTH_FRACTION ? MIN_BOX_WIDTH_FRACTION : value > MAX_BOX_WIDTH_FRACTION ? MAX_BOX_WIDTH_FRACTION : value;
}

export function clampBoxHeight(value: number): number {
  return value < MIN_BOX_HEIGHT_FRACTION ? MIN_BOX_HEIGHT_FRACTION : value > MAX_BOX_HEIGHT_FRACTION ? MAX_BOX_HEIGHT_FRACTION : value;
}

// Android-first system font families (this app ships an Android APK first; iOS-specific
// families / bundled display fonts like Impact are a later refinement). Each maps to a
// real family the Skia system font manager resolves on Android.
export const FONT_OPTIONS: { id: string; label: string; families: string[] }[] = [
  { id: 'impact', label: 'Impact', families: ['sans-serif-black', 'sans-serif'] },
  { id: 'condensed', label: 'Condensed', families: ['sans-serif-condensed'] },
  { id: 'classic', label: 'Classic', families: ['sans-serif'] },
  { id: 'serif', label: 'Serif', families: ['serif'] },
  { id: 'mono', label: 'Mono', families: ['monospace'] },
  { id: 'script', label: 'Script', families: ['cursive'] },
];

// Native-only: resolves to Android system font family names. Web has no OS font manager to
// resolve these against — `skiaMeme.tsx` calls `webFontFamily` from `skiaFonts.web.ts` instead,
// kept out of this file so it stays safe to import from the eagerly-loaded creatorDraftSlice.
export function resolveFontFamilies(fontId: string): string[] {
  return FONT_OPTIONS.find((f) => f.id === fontId)?.families ?? FONT_OPTIONS[0].families;
}

export const COLOR_SWATCHES = [
  '#FFFFFF',
  '#000000',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
];

export const STROKE_WIDTH_OPTIONS: { id: string; label: string; value: number }[] = [
  { id: 'none', label: 'None', value: 0 },
  { id: 'thin', label: 'Thin', value: 0.06 },
  { id: 'thick', label: 'Thick', value: 0.13 },
];

const DEFAULT_STYLE: TextStyleSpec = {
  fontId: 'impact',
  color: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidthFraction: 0.13,
  align: 'center',
  shadow: false,
};

let layerCounter = 0;
function nextLayerId(): string {
  layerCounter += 1;
  return `layer-${Date.now().toString(36)}-${layerCounter}`;
}

export function createTextLayer(
  overrides: Partial<Omit<TextLayer, 'kind' | 'style'>> & { style?: Partial<TextStyleSpec> } = {}
): TextLayer {
  const { style: styleOverride, ...rest } = overrides;
  return {
    id: nextLayerId(),
    text: 'Tap to edit',
    pos: { x: 0.5, y: 0.5 },
    scale: 1,
    rotation: 0,
    ...rest,
    kind: 'text',
    style: { ...DEFAULT_STYLE, ...styleOverride },
  };
}

// An emoji sticker is a text layer with no outline, sized up a bit, in a plain family so
// the device color-emoji font is used.
export function createEmojiLayer(emoji: string): TextLayer {
  return createTextLayer({ text: emoji, scale: 2, style: { strokeWidthFraction: 0, fontId: 'classic' } });
}

export function createImageLayer(uri: string): ImageLayer {
  return { id: nextLayerId(), kind: 'image', uri, pos: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0 };
}

// Deep-copies any layer with a fresh id — layers are plain JSON, so a stringify round-trip
// fully detaches nested style. Used for duplicate.
export function cloneLayer(layer: Layer): Layer {
  const copy = JSON.parse(JSON.stringify(layer)) as Layer;
  copy.id = nextLayerId();
  return copy;
}

export function createInitialDocument(baseImageUri: string | null = null): MemeDocument {
  return {
    baseImageUri,
    canvas: { aspectId: 'square', fit: 'contain', bg: '#000000' },
    layers: [],
    selectedId: null,
  };
}

export function getSelectedLayer(doc: MemeDocument): Layer | null {
  return doc.layers.find((l) => l.id === doc.selectedId) ?? null;
}

export function clamp01(value: number): number {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function clampScale(value: number): number {
  return value < SCALE_MIN ? SCALE_MIN : value > SCALE_MAX ? SCALE_MAX : value;
}

// Horizontal offset (px) of the text block's center within the size-wide paragraph box,
// given its alignment and measured longest-line width. Center-aligned text sits at the
// box center; left/right hug their edge, so their block center shifts by half the line.
export function alignedCenterX(align: TextAlignId, size: number, longestLine: number): number {
  if (align === 'left') return longestLine / 2;
  if (align === 'right') return size - longestLine / 2;
  return size / 2;
}
