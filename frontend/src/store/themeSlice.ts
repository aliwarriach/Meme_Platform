import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { colorScheme } from 'nativewind';
import { Appearance } from 'react-native';

import { getStoredThemeMode, setStoredThemeMode, type ThemeMode } from '@/services/themeStorage';

export type { ThemeMode };

interface ThemeState {
  mode: ThemeMode;
  isHydrated: boolean;
}

// Dark is the safe pre-hydration default — it matches the app's pre-toggle identity, so the
// brief window before `hydrateThemeMode` resolves (gated behind the splash screen in
// `app/_layout.tsx`, same as `bootstrapAuth`) never flashes an unintended mode.
const initialState: ThemeState = {
  mode: 'dark',
  isHydrated: false,
};

// `colorScheme.set()` calls React Native's `Appearance.setColorScheme()` under the hood, which
// bridges to a native module method that isn't guaranteed available on every RN/platform build
// (it can throw "not implemented" on some Android configurations). This app's own NativeWind
// styling is driven by the CSS `.dark` class this triggers, which is worth keeping even if the
// OS-level appearance override itself fails — never let this take the whole app down.
function setColorSchemeSafely(mode: ThemeMode): void {
  try {
    colorScheme.set(mode);
  } catch (error) {
    if (__DEV__) console.warn('colorScheme.set() failed:', error);
  }
}

export const hydrateThemeMode = createAsyncThunk('theme/hydrate', async () => {
  const stored = await getStoredThemeMode();
  const mode = stored ?? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  setColorSchemeSafely(mode);
  return mode;
});

export const toggleThemeMode = createAsyncThunk(
  'theme/toggle',
  async (_: void, { getState }) => {
    const current = (getState() as { theme: ThemeState }).theme.mode;
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    setColorSchemeSafely(next);
    await setStoredThemeMode(next);
    return next;
  }
);

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateThemeMode.fulfilled, (state, action) => {
        state.mode = action.payload;
        state.isHydrated = true;
      })
      .addCase(hydrateThemeMode.rejected, (state) => {
        setColorSchemeSafely(state.mode);
        state.isHydrated = true;
      })
      .addCase(toggleThemeMode.fulfilled, (state, action) => {
        state.mode = action.payload;
      });
  },
});

export const selectThemeMode = (state: { theme: ThemeState }) => state.theme.mode;
export const selectIsThemeHydrated = (state: { theme: ThemeState }) => state.theme.isHydrated;

export default themeSlice.reducer;
