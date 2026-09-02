import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { api, setAuthToken } from '@/services/api';
import { clearStoredToken, getStoredToken, setStoredToken } from '@/services/tokenStorage';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarPreset: string | null;
  emailVerifiedAt: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isBootstrapped: boolean;
}

const initialState: AuthState = {
  token: null,
  user: null,
  isBootstrapped: false,
};

function toAuthUser(raw: {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_preset: string | null;
  email_verified_at: string | null;
}): AuthUser {
  return {
    id: raw.id,
    email: raw.email,
    username: raw.username,
    bio: raw.bio,
    avatarUrl: raw.avatar_url,
    avatarPreset: raw.avatar_preset,
    emailVerifiedAt: raw.email_verified_at,
  };
}

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_: void, { dispatch }) => {
  const token = await getStoredToken();
  if (!token) return null;

  setAuthToken(token);
  const response = await api.get<{
    id: string;
    email: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_preset: string | null;
    email_verified_at: string | null;
  }>('/auth/me');

  if (!response.ok || !response.data) {
    await clearStoredToken();
    setAuthToken(null);
    return null;
  }

  dispatch(authSlice.actions.setCredentials({ token, user: toAuthUser(response.data) }));
  return null;
});

export const persistCredentials = createAsyncThunk(
  'auth/persistCredentials',
  async (payload: {
    token: string;
    user: {
      id: string;
      email: string;
      username: string;
      bio: string | null;
      avatar_url: string | null;
      avatar_preset: string | null;
      email_verified_at: string | null;
    };
  }) => {
    await setStoredToken(payload.token);
    return { token: payload.token, user: toAuthUser(payload.user) };
  }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  // Best-effort server-side revocation (bumps token_version, invalidating the JWT
  // immediately rather than leaving it valid for the rest of its 24h lifetime). A
  // network failure still clears the device locally — the user asked to sign out and
  // that must always succeed locally, even if the server can't be reached right now.
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignored — local sign-out proceeds regardless.
  }
  await clearStoredToken();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      setAuthToken(action.payload.token);
    },
    setEmailVerified(state, action: PayloadAction<string>) {
      if (state.user) state.user.emailVerifiedAt = action.payload;
    },
    setAvatar(state, action: PayloadAction<{ avatarUrl: string | null; avatarPreset: string | null }>) {
      if (!state.user) return;
      state.user.avatarUrl = action.payload.avatarUrl;
      state.user.avatarPreset = action.payload.avatarPreset;
    },
    setBio(state, action: PayloadAction<string | null>) {
      if (!state.user) return;
      state.user.bio = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.fulfilled, (state) => {
        state.isBootstrapped = true;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.isBootstrapped = true;
      })
      .addCase(persistCredentials.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        setAuthToken(action.payload.token);
      })
      .addCase(signOut.fulfilled, (state) => {
        state.token = null;
        state.user = null;
        setAuthToken(null);
      });
  },
});

export const { setCredentials, setEmailVerified, setAvatar, setBio } = authSlice.actions;
export default authSlice.reducer;
