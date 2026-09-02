import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAvoidingViewProps,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

/**
 * The app's single keyboard-avoidance mechanism (react-native-keyboard-controller, wrapped
 * app-wide by `KeyboardProvider` in `app/_layout.tsx`) — three thin wrappers, one per UI shape
 * in this codebase, so no screen hand-rolls its own `Keyboard.addListener`/height-tracking again:
 *
 * - `KeyboardAvoidingScreen`: a `flex-1` container (list + inline content, or a bottom sheet's
 *   body) that should shift/shrink as a whole so nothing inside it ever sits behind the keyboard.
 *   Use for screens built on `FlatList` (search/results screens, profile) and for modal/sheet
 *   content. Deliberately not scroll-aware — see `StickyKeyboardFooter` below for why chat modals
 *   use that instead, and note it's the non-scroll-aware `KeyboardAvoidingView` (not
 *   `KeyboardAwareScrollView`) precisely because RNKC's scroll-aware variant has an open Android
 *   touch-responsiveness bug specifically inside RN's `Modal` (kirillzyusko/react-native-keyboard-controller#710)
 *   — every consumer of this component here renders inside a `Modal` (`BottomSheet`, `WebModalFrame`)
 *   or a screen using `FlatList`, so this needs to stay the plain (non-scroll) variant.
 * - `KeyboardAwareForm`: drop-in `ScrollView` replacement for plain form screens (login/register/
 *   create-* screens) — auto-scrolls whichever field is focused to just above the keyboard as the
 *   user tabs between fields, which a bare `ScrollView` never does on its own.
 * - `StickyKeyboardFooter`: pins a fixed composer (chat/DM input) to the top of the keyboard
 *   without resizing the message list above it — the WhatsApp/Instagram-DM pattern. Use only for
 *   a genuinely fixed, screen-bottom composer that isn't already inside something wrapped in
 *   `KeyboardAvoidingScreen` (a comments sheet's composer, for instance, doesn't need this —
 *   its parent sheet already handles it via `KeyboardAvoidingScreen`).
 */

interface KeyboardAvoidingScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** RNKC's `KeyboardAvoidingView` is a no-op unless a `behavior` is given — it has no
   * built-in default, unlike RN's own component of the same name. `"padding"` (reserve
   * `paddingBottom` equal to the keyboard's overlap, shrinking the content box from the
   * bottom) is the default here, deliberately NOT `"height"` — verified in RNKC's own source
   * (`KeyboardAvoidingView/index.tsx`): `"height"` mode only re-measures its container
   * (`initialFrame`) while the keyboard is *closed* (`onLayoutWorklet`'s freeze condition
   * checks `keyboard.isClosed.value` specifically for that one behavior), so any resize that
   * happens *while the keyboard is already open* — e.g. dragging `BottomSheet`'s handle to
   * expand it, which comments' `autoFocus` field makes the common case, not an edge case — is
   * invisible to it: the composer stays clamped to whatever size was last measured before the
   * keyboard opened, leaving a growing gap as the sheet is dragged taller. `"padding"`/
   * `"position"`/`"translate-with-padding"` all re-measure on every layout unconditionally, so
   * they track a live-resizing container correctly. Override only for a specific, verified
   * reason — and never back to `"height"` for anything that can resize while focused. */
  behavior?: KeyboardAvoidingViewProps['behavior'];
}

export function KeyboardAvoidingScreen({
  children,
  style,
  className,
  behavior = 'padding',
}: KeyboardAvoidingScreenProps) {
  return (
    // `automaticOffset` (off by default in RNKC) makes it measure its true position on the
    // physical screen instead of the position relative to its immediate parent. Without it,
    // a `BottomSheet`'s content — bottom-anchored, offset down the screen rather than flush to
    // the top — reports a `y` close to 0 (relative to the sheet, not the screen), so RNKC thinks
    // it starts almost at the top and badly under-reserves space for the keyboard, leaving the
    // keyboard covering more of the content than it should. Screens where this view already
    // sits flush under the top edge (no measurable difference) are unaffected either way.
    <KeyboardAvoidingView
      behavior={behavior}
      automaticOffset
      style={[{ flex: 1 }, style]}
      className={className}>
      {children}
    </KeyboardAvoidingView>
  );
}

export function KeyboardAwareForm({
  children,
  bottomOffset = 24,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...rest}>
      {children}
    </KeyboardAwareScrollView>
  );
}

interface StickyKeyboardFooterProps {
  children: ReactNode;
  /** Extra `translateY` applied on top of the view's normal resting position, in the keyboard's
   * direction of travel — i.e. **positive pushes further down/away from view**, whichever state
   * (open/closed) it's set for. Do NOT use `closedOffset` for bottom safe-area padding — a fixed
   * composer already sits at its natural in-flow position when the keyboard is closed, so a
   * positive `closedOffset` pushes it *off* the bottom edge instead of clearing it. Give the
   * child its own `paddingBottom: insets.bottom` for that (see `ThreadScreen`'s `Composer`).
   * These offsets are for genuine one-off nudges (e.g. extra clearance once the keyboard's open,
   * matching a divider/shadow) — leave both at 0 unless you have a specific, verified reason. */
  openOffset?: number;
  closedOffset?: number;
}

export function StickyKeyboardFooter({
  children,
  openOffset = 0,
  closedOffset = 0,
}: StickyKeyboardFooterProps) {
  return (
    <KeyboardStickyView offset={{ closed: closedOffset, opened: openOffset }}>
      {children}
    </KeyboardStickyView>
  );
}
