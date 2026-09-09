/**
 * Design tokens for the desktop-web layout (sidebar nav, dashboard grid,
 * table/grid screens - see useIsDesktopWeb()). Entirely additive: nothing
 * in src/theme/index.ts or theme/colors.ts changes, so native and
 * narrower/tablet web keep their existing look untouched.
 *
 * Typography: Fraunces (an editorial serif with real character - warm,
 * slightly quirky optical sizing) for display numbers and page titles,
 * paired with Inter for everything else. Inter is also this codebase's own
 * stated original intent (see the now-fulfilled `fontFamily` note in
 * theme/index.ts) - so this isn't a new direction so much as finishing one
 * that was already named but never wired up. The pairing gives the web
 * dashboard an "editorial fintech" feel - premium and considered without
 * copying a specific product - while staying legible at data-dense sizes.
 * Fonts are loaded by src/web/loadWebFonts.ts.
 */

export const webFonts = {
  display: "'Fraunces', Georgia, 'Iowan Old Style', serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Persistent left nav width. */
export const sidebarWidth = 252;

/** Content column caps, wider than the tablet-web WebContainer tiers. */
export const webContentMaxWidth = 1240;

/**
 * A more generous scale than the mobile `spacing` scale (theme/index.ts),
 * which was tuned for a 390px frame. Desktop has room to breathe.
 */
export const webSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
} as const;

/** Softer, larger radii than the mobile card scale - reads as "desktop app" rather than "phone card, but bigger". */
export const webRadii = {
  card: 20,
  hero: 24,
  dialog: 24,
  pill: 100,
} as const;

/**
 * react-native-web's current (non-deprecated) shadow API is the CSS
 * `boxShadow` string - the legacy `shadow*` props still work but log a
 * deprecation warning on web (verified against the installed
 * react-native-web version's source). These are cast through at the call
 * site since `boxShadow` isn't in core RN's ViewStyle type.
 */
export const webShadow = {
  card: '0 1px 2px rgba(0,0,0,0.14), 0 14px 32px -16px rgba(0,0,0,0.38)',
  hero: '0 1px 2px rgba(0,0,0,0.16), 0 20px 44px -18px rgba(45,212,191,0.22)',
  dialog: '0 30px 70px -20px rgba(0,0,0,0.55)',
} as const;
