import { describe, expect, test } from '@jest/globals';

import {
  alignedCenterX,
  aspectRatio,
  canvasPixels,
  clamp01,
  clampBoxHeight,
  clampBoxWidth,
  clampScale,
  cloneLayer,
  createEmojiLayer,
  createImageLayer,
  createInitialDocument,
  createTextLayer,
  EXPORT_MAX_SIDE,
  FONT_OPTIONS,
  getSelectedLayer,
  isTextLayer,
  MAX_BOX_HEIGHT_FRACTION,
  MAX_BOX_WIDTH_FRACTION,
  MIN_BOX_HEIGHT_FRACTION,
  MIN_BOX_WIDTH_FRACTION,
  resolveFontFamilies,
  SCALE_MAX,
  SCALE_MIN,
} from '@/features/creator/document';

describe('document — factories', () => {
  test('createTextLayer applies defaults and a unique id each call', () => {
    const a = createTextLayer();
    const b = createTextLayer();
    expect(a.id).not.toBe(b.id);
    expect(a.pos).toEqual({ x: 0.5, y: 0.5 });
    expect(a.scale).toBe(1);
    expect(a.rotation).toBe(0);
    expect(a.style.fontId).toBe('impact');
    expect(a.style.align).toBe('center');
  });

  test('createTextLayer deep-merges the style override', () => {
    const layer = createTextLayer({ text: 'Hi', style: { color: '#000000' } });
    expect(layer.text).toBe('Hi');
    expect(layer.style.color).toBe('#000000');
    // other style fields keep their defaults
    expect(layer.style.strokeColor).toBe('#000000');
    expect(layer.style.align).toBe('center');
  });

  test('createInitialDocument is empty, unselected, and a square Fit canvas', () => {
    const doc = createInitialDocument();
    expect(doc.layers).toHaveLength(0);
    expect(doc.selectedId).toBeNull();
    expect(doc.baseImageUri).toBeNull();
    expect(doc.canvas).toEqual({ aspectId: 'square', fit: 'contain', bg: '#000000' });
  });

  test('getSelectedLayer resolves the selected id or null', () => {
    const layer = createTextLayer();
    const doc = { ...createInitialDocument(), layers: [layer], selectedId: layer.id };
    expect(getSelectedLayer(doc)?.id).toBe(layer.id);
    expect(getSelectedLayer({ ...doc, selectedId: null })).toBeNull();
    expect(getSelectedLayer({ ...doc, selectedId: 'nope' })).toBeNull();
  });
});

describe('document — canvas', () => {
  test('aspectRatio returns width/height for a preset or 1 for unknown', () => {
    expect(aspectRatio('square')).toBe(1);
    expect(aspectRatio('story')).toBeCloseTo(9 / 16);
    // @ts-expect-error deliberately invalid id falls back to square
    expect(aspectRatio('nope')).toBe(1);
  });

  test('canvasPixels pins the longer side to maxSide for every orientation', () => {
    const square = canvasPixels('square', EXPORT_MAX_SIDE);
    expect(square).toEqual({ w: 1080, h: 1080 });

    const portrait = canvasPixels('story', EXPORT_MAX_SIDE); // 9:16, tall
    expect(portrait.h).toBe(1080);
    expect(portrait.w).toBeLessThan(portrait.h);
    expect(Math.max(portrait.w, portrait.h)).toBe(EXPORT_MAX_SIDE);

    const landscape = canvasPixels('landscape', EXPORT_MAX_SIDE); // 16:9, wide
    expect(landscape.w).toBe(1080);
    expect(landscape.h).toBeLessThan(landscape.w);
  });
});

describe('document — layer kinds', () => {
  test('createTextLayer is tagged as a text layer', () => {
    const layer = createTextLayer();
    expect(layer.kind).toBe('text');
    expect(isTextLayer(layer)).toBe(true);
  });

  test('createImageLayer holds the uri and is not a text layer', () => {
    const layer = createImageLayer('file:///a.png');
    expect(layer.kind).toBe('image');
    expect(layer.uri).toBe('file:///a.png');
    expect(layer.pos).toEqual({ x: 0.5, y: 0.5 });
    expect(layer.scale).toBe(1);
    expect(isTextLayer(layer)).toBe(false);
  });

  test('createEmojiLayer is an outline-free, sized-up text layer', () => {
    const layer = createEmojiLayer('💀');
    expect(layer.kind).toBe('text');
    expect(layer.text).toBe('💀');
    expect(layer.style.strokeWidthFraction).toBe(0);
    expect(layer.scale).toBeGreaterThan(1);
  });

  test('cloneLayer produces a new id and a fully detached copy', () => {
    const original = createTextLayer({ text: 'hi', style: { color: '#000000' } });
    const clone = cloneLayer(original);
    expect(clone.id).not.toBe(original.id);
    expect(clone.kind).toBe('text');
    if (clone.kind === 'text' && original.kind === 'text') {
      clone.style.color = '#FFFFFF';
      expect(original.style.color).toBe('#000000'); // deep copy, not a shared reference
    }
  });
});

describe('document — geometry & clamps', () => {
  test('clamp01 bounds a value to [0,1]', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
  });

  test('clampScale bounds a value to the scale range', () => {
    expect(clampScale(0.01)).toBe(SCALE_MIN);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(1000)).toBe(SCALE_MAX);
  });

  test('alignedCenterX places the text block by alignment', () => {
    const size = 1000;
    const line = 400;
    expect(alignedCenterX('center', size, line)).toBe(500);
    expect(alignedCenterX('left', size, line)).toBe(200);
    expect(alignedCenterX('right', size, line)).toBe(800);
  });

  test('clampBoxWidth/Height bound a resize-handle box to its allowed fractions', () => {
    expect(clampBoxWidth(0)).toBe(MIN_BOX_WIDTH_FRACTION);
    expect(clampBoxWidth(0.5)).toBe(0.5);
    expect(clampBoxWidth(10)).toBe(MAX_BOX_WIDTH_FRACTION);
    expect(clampBoxHeight(0)).toBe(MIN_BOX_HEIGHT_FRACTION);
    expect(clampBoxHeight(0.3)).toBe(0.3);
    expect(clampBoxHeight(10)).toBe(MAX_BOX_HEIGHT_FRACTION);
  });
});

describe('document — fonts', () => {
  test('resolveFontFamilies returns a known family or falls back to the first option', () => {
    expect(resolveFontFamilies('serif')).toEqual(
      FONT_OPTIONS.find((f) => f.id === 'serif')?.families
    );
    expect(resolveFontFamilies('does-not-exist')).toEqual(FONT_OPTIONS[0].families);
  });
});
