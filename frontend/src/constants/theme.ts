/**
 * Hex values for native color props that can't take a NativeWind className
 * (e.g. `ActivityIndicator`'s `color`, `TextInput`'s `placeholderTextColor`).
 * These must mirror the matching token in `tailwind.config.js` — keep in sync
 * by hand, there is no build-time link between the two.
 */

/** Mirrors the `ink-muted` color token (#e3bdc5) — secondary/meta text, loading spinners. */
export const INK_MUTED = '#e3bdc5';

/** Mirrors the `primary-dim` color token (#ffb1c4) — icon/text sitting on a tinted-primary fill. */
export const PRIMARY_DIM = '#ffb1c4';
