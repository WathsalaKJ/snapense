/**
 * Loads the desktop-web font pairing (Fraunces for display/headlines,
 * Inter for body/UI - see src/theme/web.ts) via a Google Fonts stylesheet
 * link injected into <head>.
 *
 * This module only ever touches `document`, so it's a genuine no-op when
 * imported on native - `Platform.OS === 'web'` is checked before anything
 * DOM-related runs, and native never has a `document` global to begin with.
 * Idempotent: safe to call from an effect that re-runs on Fast Refresh.
 */

import { Platform } from 'react-native';

const LINK_ID = 'snapense-web-fonts';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  'family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&' +
  'family=Inter:wght@400;500;600;700;800&' +
  'display=swap';

export function loadWebFonts(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(LINK_ID)) return;

  const preconnectGoogle = document.createElement('link');
  preconnectGoogle.rel = 'preconnect';
  preconnectGoogle.href = 'https://fonts.googleapis.com';

  const preconnectGstatic = document.createElement('link');
  preconnectGstatic.rel = 'preconnect';
  preconnectGstatic.href = 'https://fonts.gstatic.com';
  preconnectGstatic.crossOrigin = 'anonymous';

  const stylesheet = document.createElement('link');
  stylesheet.id = LINK_ID;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = FONTS_HREF;

  document.head.appendChild(preconnectGoogle);
  document.head.appendChild(preconnectGstatic);
  document.head.appendChild(stylesheet);
}
