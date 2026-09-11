/**
 * Neutralizes the browser's built-in autofill styling on web.
 *
 * When a browser (Safari/Chrome) autofills an <input> - which is what
 * TextInput renders to on react-native-web - it forces its own background
 * (a pale yellow/cream in most browsers) via the `:-webkit-autofill`
 * pseudo-class, overriding any `backgroundColor` set through React Native's
 * StyleSheet or inline style props. That pseudo-class can only be targeted
 * with real CSS, so - like loadWebFonts.ts - this injects a <style> tag
 * rather than trying to fight it through RN's style system.
 *
 * The fill/text colors are read from CSS custom properties (see
 * ThemeContext.tsx, which keeps --sn-autofill-bg/--sn-autofill-text in sync
 * with the active theme) so the override tracks light/dark/system just like
 * everything else, instead of baking in one theme's colors.
 *
 * This module only ever touches `document`, so it's a genuine no-op on
 * native. Idempotent: safe to call more than once (e.g. Fast Refresh).
 */

import { Platform } from 'react-native';

const STYLE_ID = 'snapense-autofill-fix';

const CSS = `
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--sn-autofill-text, #F9FAFB) !important;
  caret-color: var(--sn-autofill-text, #F9FAFB) !important;
  -webkit-box-shadow: 0 0 0 1000px var(--sn-autofill-bg, #111827) inset !important;
  box-shadow: 0 0 0 1000px var(--sn-autofill-bg, #111827) inset !important;
  /* Chrome fades the autofill color in via a background-color transition;
     stalling it this long keeps that fade from ever completing. */
  transition: background-color 9999s ease-in-out 0s;
}
`;

export function fixAutofillStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
