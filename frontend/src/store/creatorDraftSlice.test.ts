import { describe, expect, test } from '@jest/globals';

import { SCALE_MAX, SCALE_MIN, type Layer, type TextLayer } from '@/features/creator/document';
import reducer, {
  addEmojiLayer,
  addImageLayer,
  addTextLayer,
  deleteSelected,
  duplicateSelected,
  redo,
  reorderSelected,
  resetDraft,
  selectLayer,
  setBaseImage,
  setSelectedPosition,
  setSelectedRotation,
  setSelectedScale,
  setSelectedText,
  undo,
  updateCanvas,
  updateSelectedStyle,
} from '@/store/creatorDraftSlice';

// Narrows a union layer to a text layer for assertions (throws if it isn't one).
const asText = (layer: Layer): TextLayer => {
  if (layer.kind !== 'text') throw new Error('expected a text layer');
  return layer;
};

// Fresh initial state straight from the reducer.
const init = () => reducer(undefined, { type: '@@INIT' });
// State with one text layer added (which is auto-selected). Past has one entry (the add).
const withOneLayer = () => reducer(init(), addTextLayer());

describe('creatorDraftSlice — layers', () => {
  test('addTextLayer appends a layer, selects it, and records history', () => {
    const state = withOneLayer();
    expect(state.present.layers).toHaveLength(1);
    expect(state.present.selectedId).toBe(state.present.layers[0].id);
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(0);
  });

  test('setBaseImage stores the uri and records history', () => {
    const state = reducer(init(), setBaseImage('file:///pic.png'));
    expect(state.present.baseImageUri).toBe('file:///pic.png');
    expect(state.past).toHaveLength(1);
  });

  test('updateCanvas merges partial canvas settings, records history, and is undoable', () => {
    const state = reducer(init(), updateCanvas({ aspectId: 'story', fit: 'cover' }));
    expect(state.present.canvas.aspectId).toBe('story');
    expect(state.present.canvas.fit).toBe('cover');
    expect(state.present.canvas.bg).toBe('#000000'); // untouched field survives the merge
    expect(state.past).toHaveLength(1);

    const undone = reducer(state, undo());
    expect(undone.present.canvas.aspectId).toBe('square');
  });

  test('duplicateSelected clones with an offset and selects the clone', () => {
    const base = withOneLayer();
    const original = base.present.layers[0];
    const state = reducer(base, duplicateSelected());
    expect(state.present.layers).toHaveLength(2);
    const clone = state.present.layers[1];
    expect(clone.id).not.toBe(original.id);
    expect(asText(clone).text).toBe(asText(original).text);
    expect(clone.pos.x).toBeCloseTo(original.pos.x + 0.05);
    expect(state.present.selectedId).toBe(clone.id);
  });

  test('deleteSelected removes the layer and clears selection', () => {
    const state = reducer(withOneLayer(), deleteSelected());
    expect(state.present.layers).toHaveLength(0);
    expect(state.present.selectedId).toBeNull();
  });

  test('reorderSelected front/back moves the layer within render order', () => {
    let state = reducer(init(), addTextLayer()); // layer A (selected)
    const a = state.present.layers[0].id;
    state = reducer(state, addTextLayer()); // layer B (selected, on top)
    const b = state.present.layers[1].id;

    state = reducer(state, reorderSelected('back')); // B to back
    expect(state.present.layers.map((l) => l.id)).toEqual([b, a]);

    state = reducer(state, reorderSelected('front')); // B to front
    expect(state.present.layers.map((l) => l.id)).toEqual([a, b]);
  });
});

describe('creatorDraftSlice — image & sticker layers', () => {
  test('addImageLayer appends an image layer and selects it', () => {
    const state = reducer(init(), addImageLayer('file:///photo.jpg'));
    const layer = state.present.layers[0];
    expect(layer.kind).toBe('image');
    expect(layer.kind === 'image' && layer.uri).toBe('file:///photo.jpg');
    expect(state.present.selectedId).toBe(layer.id);
    expect(state.past).toHaveLength(1);
  });

  test('addEmojiLayer appends a text layer with the emoji and no outline', () => {
    const state = reducer(init(), addEmojiLayer('🔥'));
    const layer = state.present.layers[0];
    expect(layer.kind).toBe('text');
    if (layer.kind === 'text') {
      expect(layer.text).toBe('🔥');
      expect(layer.style.strokeWidthFraction).toBe(0);
    }
  });

  test('text-only edits are no-ops on an image layer', () => {
    const base = reducer(init(), addImageLayer('file:///photo.jpg'));
    const afterText = reducer(base, setSelectedText('nope'));
    expect(afterText).toEqual(base); // image layer has no text to set
    const afterStyle = reducer(base, updateSelectedStyle({ color: '#EF4444' }));
    expect(afterStyle).toEqual(base); // and no style, so no history either
  });

  test('duplicateSelected clones an image layer as a new independent image layer', () => {
    const base = reducer(init(), addImageLayer('file:///photo.jpg'));
    const original = base.present.layers[0];
    const state = reducer(base, duplicateSelected());
    const clone = state.present.layers[1];
    expect(state.present.layers).toHaveLength(2);
    expect(clone.kind).toBe('image');
    expect(clone.id).not.toBe(original.id);
    expect(clone.kind === 'image' && clone.uri).toBe('file:///photo.jpg');
    expect(state.present.selectedId).toBe(clone.id);
  });
});

describe('creatorDraftSlice — selected-layer edits', () => {
  test('setSelectedText updates text without adding history', () => {
    const base = withOneLayer();
    const before = base.past.length;
    const state = reducer(base, setSelectedText('hello'));
    expect(asText(state.present.layers[0]).text).toBe('hello');
    expect(state.past).toHaveLength(before); // typing is not an undo step
  });

  test('updateSelectedStyle merges partial style and records history', () => {
    const base = withOneLayer();
    const state = reducer(base, updateSelectedStyle({ color: '#EF4444', align: 'left' }));
    expect(asText(state.present.layers[0]).style.color).toBe('#EF4444');
    expect(asText(state.present.layers[0]).style.align).toBe('left');
    // untouched fields survive the merge
    expect(asText(state.present.layers[0]).style.fontId).toBe(asText(base.present.layers[0]).style.fontId);
    expect(state.past.length).toBe(base.past.length + 1);
  });

  test('setSelectedPosition clamps to the [0,1] canvas', () => {
    const state = reducer(withOneLayer(), setSelectedPosition({ x: 1.4, y: -0.3 }));
    expect(state.present.layers[0].pos).toEqual({ x: 1, y: 0 });
  });

  test('setSelectedScale clamps to the allowed range', () => {
    expect(reducer(withOneLayer(), setSelectedScale(99)).present.layers[0].scale).toBe(SCALE_MAX);
    expect(reducer(withOneLayer(), setSelectedScale(0)).present.layers[0].scale).toBe(SCALE_MIN);
  });

  test('setSelectedRotation stores the absolute angle', () => {
    const state = reducer(withOneLayer(), setSelectedRotation(1.5));
    expect(state.present.layers[0].rotation).toBe(1.5);
  });

  test('edits with no selection are no-ops', () => {
    const empty = init();
    expect(reducer(empty, setSelectedText('x'))).toEqual(empty);
    expect(reducer(empty, setSelectedScale(2))).toEqual(empty);
    expect(reducer(empty, deleteSelected())).toEqual(empty);
  });
});

describe('creatorDraftSlice — history', () => {
  test('undo restores the previous document; redo re-applies it', () => {
    const base = withOneLayer();
    const withImage = reducer(base, setBaseImage('file:///a.png'));

    const undone = reducer(withImage, undo());
    expect(undone.present.baseImageUri).toBeNull();
    expect(undone.present.layers).toHaveLength(1);
    expect(undone.future).toHaveLength(1);

    const redone = reducer(undone, redo());
    expect(redone.present.baseImageUri).toBe('file:///a.png');
    expect(redone.future).toHaveLength(0);
  });

  test('a new edit clears the redo stack', () => {
    const base = withOneLayer();
    const undone = reducer(base, undo());
    expect(undone.future).toHaveLength(1);
    const edited = reducer(undone, addTextLayer());
    expect(edited.future).toHaveLength(0);
  });

  test('selectLayer does not record history', () => {
    const base = withOneLayer();
    const state = reducer(base, selectLayer(null));
    expect(state.present.selectedId).toBeNull();
    expect(state.past).toHaveLength(base.past.length);
  });

  test('resetDraft clears document and history', () => {
    const dirty = reducer(withOneLayer(), setBaseImage('file:///a.png'));
    const state = reducer(dirty, resetDraft());
    expect(state.present.layers).toHaveLength(0);
    expect(state.present.baseImageUri).toBeNull();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  test('undo/redo are no-ops at the ends of history', () => {
    const empty = init();
    expect(reducer(empty, undo())).toEqual(empty);
    expect(reducer(empty, redo())).toEqual(empty);
  });
});
