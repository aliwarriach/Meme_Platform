/** Fixed set of built-in avatars a user can pick when they have no uploaded profile picture —
 * bundled gradient + emoji combos (no image assets needed, nothing to host), rendered
 * identically by every client via `avatar_preset`'s id. Mirrors `ALLOWED_AVATAR_PRESETS` in
 * `backend/app/services/users.py` — keep both lists in sync; the backend is the real gate,
 * this is just what the picker offers. */
export interface AvatarPreset {
  id: string;
  label: string;
  emoji: string;
  gradient: [string, string];
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'blaze', label: 'Blaze', emoji: '🔥', gradient: ['#FF6B6B', '#FFD93D'] },
  { id: 'chill', label: 'Chill', emoji: '😎', gradient: ['#4FACFE', '#00F2FE'] },
  { id: 'goblin', label: 'Goblin Mode', emoji: '👾', gradient: ['#43E97B', '#38F9D7'] },
  { id: 'royal', label: 'Royal', emoji: '👑', gradient: ['#C471ED', '#F7797D'] },
  { id: 'frog', label: 'Frog', emoji: '🐸', gradient: ['#0BA360', '#3CBA92'] },
];

export function getAvatarPreset(id: string | null | undefined): AvatarPreset | undefined {
  if (!id) return undefined;
  return AVATAR_PRESETS.find((preset) => preset.id === id);
}
