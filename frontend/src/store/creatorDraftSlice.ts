import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';

import {
  type CanvasSpec,
  clampScale,
  cloneLayer,
  createEmojiLayer,
  createImageLayer,
  createInitialDocument,
  createTextLayer,
  type MemeDocument,
  type TextStyleSpec,
} from '@/features/creator/document';

// Undo/redo is a bounded past/present/future stack over the whole document. A document
// references the base image by URI (never pixels) and holds only lightweight layer data,
// so a snapshot is a few bytes of JSON — cheap to clone, so history can be generous.
//
// History is recorded for structural edits (add/duplicate/delete/reorder layer, base
// image, a committed drag/scale/rotate, a style change). Live text typing and selection
// changes update the present without flooding history.
const HISTORY_LIMIT = 50;

interface CreatorDraftState {
  past: MemeDocument[];
  present: MemeDocument;
  future: MemeDocument[];
}

const initialState: CreatorDraftState = {
  past: [],
  present: createInitialDocument(),
  future: [],
};

// Snapshot the present with Immer's `current()` — pushing the live draft reference and
// then mutating it would alias the "snapshot" to the mutated object, so undo couldn't
// revert. `current()` detaches a plain copy.
function recordHistory(state: CreatorDraftState) {
  state.past.push(current(state.present));
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

function selected(doc: MemeDocument) {
  return doc.layers.find((l) => l.id === doc.selectedId) ?? null;
}

const creatorDraftSlice = createSlice({
  name: 'creatorDraft',
  initialState,
  reducers: {
    setBaseImage(state, action: PayloadAction<string>) {
      recordHistory(state);
      state.present.baseImageUri = action.payload;
    },
    updateCanvas(state, action: PayloadAction<Partial<CanvasSpec>>) {
      recordHistory(state);
      state.present.canvas = { ...state.present.canvas, ...action.payload };
    },
    addTextLayer(state) {
      recordHistory(state);
      const layer = createTextLayer();
      state.present.layers.push(layer);
      state.present.selectedId = layer.id;
    },
    addEmojiLayer(state, action: PayloadAction<string>) {
      recordHistory(state);
      const layer = createEmojiLayer(action.payload);
      state.present.layers.push(layer);
      state.present.selectedId = layer.id;
    },
    addImageLayer(state, action: PayloadAction<string>) {
      recordHistory(state);
      const layer = createImageLayer(action.payload);
      state.present.layers.push(layer);
      state.present.selectedId = layer.id;
    },
    selectLayer(state, action: PayloadAction<string | null>) {
      state.present.selectedId = action.payload;
    },
    // Text-only edits — no-ops on an image layer.
    setSelectedText(state, action: PayloadAction<string>) {
      const layer = selected(state.present);
      if (layer && layer.kind === 'text') layer.text = action.payload;
    },
    updateSelectedStyle(state, action: PayloadAction<Partial<TextStyleSpec>>) {
      const layer = selected(state.present);
      if (!layer || layer.kind !== 'text') return;
      recordHistory(state);
      layer.style = { ...layer.style, ...action.payload };
    },
    // Absolute transform setters for the selected layer. The gesture worklet keeps live
    // absolute values (synced from the doc) and commits the final value on release, which
    // is what keeps the commit flicker-free — the on-screen transform reads the same
    // absolute value the reducer stores, never a base+delta combination.
    setSelectedPosition(state, action: PayloadAction<{ x: number; y: number }>) {
      const layer = selected(state.present);
      if (!layer) return;
      recordHistory(state);
      layer.pos = {
        x: Math.min(1, Math.max(0, action.payload.x)),
        y: Math.min(1, Math.max(0, action.payload.y)),
      };
    },
    setSelectedScale(state, action: PayloadAction<number>) {
      const layer = selected(state.present);
      if (!layer) return;
      recordHistory(state);
      layer.scale = clampScale(action.payload);
    },
    setSelectedRotation(state, action: PayloadAction<number>) {
      const layer = selected(state.present);
      if (!layer) return;
      recordHistory(state);
      layer.rotation = action.payload;
    },
    duplicateSelected(state) {
      const layer = selected(state.present);
      if (!layer) return;
      recordHistory(state);
      const clone = cloneLayer(layer);
      clone.pos = { x: Math.min(1, layer.pos.x + 0.05), y: Math.min(1, layer.pos.y + 0.05) };
      state.present.layers.push(clone);
      state.present.selectedId = clone.id;
    },
    deleteSelected(state) {
      const layer = selected(state.present);
      if (!layer) return;
      recordHistory(state);
      state.present.layers = state.present.layers.filter((l) => l.id !== layer.id);
      state.present.selectedId = null;
    },
    // Reorder the selected layer within the render-order array. 'front' = topmost.
    reorderSelected(state, action: PayloadAction<'front' | 'back'>) {
      const layers = state.present.layers;
      const index = layers.findIndex((l) => l.id === state.present.selectedId);
      if (index < 0) return;
      recordHistory(state);
      const [layer] = layers.splice(index, 1);
      if (action.payload === 'front') layers.push(layer);
      else layers.unshift(layer);
    },
    resetDraft(state) {
      state.past = [];
      state.present = createInitialDocument();
      state.future = [];
    },
    undo(state) {
      const previous = state.past.pop();
      if (!previous) return;
      state.future.unshift(current(state.present));
      state.present = previous;
    },
    redo(state) {
      const next = state.future.shift();
      if (!next) return;
      state.past.push(current(state.present));
      state.present = next;
    },
  },
});

export const {
  setBaseImage,
  updateCanvas,
  addTextLayer,
  addEmojiLayer,
  addImageLayer,
  selectLayer,
  setSelectedText,
  updateSelectedStyle,
  setSelectedPosition,
  setSelectedScale,
  setSelectedRotation,
  duplicateSelected,
  deleteSelected,
  reorderSelected,
  resetDraft,
  undo,
  redo,
} = creatorDraftSlice.actions;
export default creatorDraftSlice.reducer;

export const selectDocument = (state: { creatorDraft: CreatorDraftState }) =>
  state.creatorDraft.present;
export const selectSelectedLayer = (state: { creatorDraft: CreatorDraftState }) => {
  const doc = state.creatorDraft.present;
  return doc.layers.find((l) => l.id === doc.selectedId) ?? null;
};
export const selectCanUndo = (state: { creatorDraft: CreatorDraftState }) =>
  state.creatorDraft.past.length > 0;
export const selectCanRedo = (state: { creatorDraft: CreatorDraftState }) =>
  state.creatorDraft.future.length > 0;
