/**
 * Colour tokens for the two app themes.
 *
 * Two palettes: `darkColors` (the default) and `lightColors`. These values are
 * the source of truth - they were lifted from the original design mockup, which
 * no longer exists in the repo, so do not hand-tune them casually. Change a
 * token here and it changes everywhere via ThemeContext.
 */

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  /** Screen background. */
  bg: string;
  /** Card / raised surface. */
  card: string;
  /** Translucent tab bar fill. */
  tabbar: string;
  /** Primary text. */
  text: string;
  /** Secondary text. */
  text2: string;
  /** Muted text (labels, captions). */
  muted: string;
  /** More muted text. */
  muted2: string;
  /** Faintest text / disabled. */
  faint: string;
  /** Hairline border. */
  line: string;
  /** Stronger border. */
  line2: string;
  /** Subtle fill (chips, wells). */
  soft: string;
  /** Stronger subtle fill. */
  softer: string;
  /** Login / onboarding gradient stops, top to bottom. */
  loginGradient: [string, string, string];
}

/** Dark palette - the app default. */
export const darkColors: ThemeColors = {
  bg: '#111827',
  card: '#1A2333',
  tabbar: 'rgba(13,19,32,0.9)',
  text: '#F9FAFB',
  text2: '#D1D5DB',
  muted: '#9CA3AF',
  muted2: '#6B7280',
  faint: '#4B5563',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.13)',
  soft: 'rgba(255,255,255,0.05)',
  softer: 'rgba(255,255,255,0.14)',
  loginGradient: ['#141D30', '#111827', '#0D1320'],
};

/** Light palette. */
export const lightColors: ThemeColors = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  tabbar: 'rgba(255,255,255,0.92)',
  text: '#0F172A',
  text2: '#334155',
  muted: '#5B6472',
  muted2: '#8A94A6',
  faint: '#9AA3B2',
  line: 'rgba(15,23,42,0.10)',
  line2: 'rgba(15,23,42,0.17)',
  soft: 'rgba(15,23,42,0.06)',
  softer: 'rgba(15,23,42,0.15)',
  loginGradient: ['#E7F6F2', '#F4F6FA', '#EAEEF5'],
};

/**
 * Brand and semantic colours. These sit outside the light/dark swap in the
 * design - the same teal is used on both themes.
 */
export const accent = {
  /** Primary brand teal. */
  teal: '#2DD4BF',
  /** Hover / pressed variant. */
  tealBright: '#5EEAD4',
  /** Positive / on-track. */
  success: '#34D399',
  /** Caution. */
  warning: '#FBBF24',
  /** Destructive + anomaly flags. */
  danger: '#FB7185',
} as const;

/** Translucent teal fills, matching the alphas used in the design. */
export const tealAlpha = (alpha: number) => `rgba(45,212,191,${alpha})`;

/** Translucent danger fills. */
export const dangerAlpha = (alpha: number) => `rgba(251,113,133,${alpha})`;

/**
 * Category colours, from the CATS map in the design file.
 *
 * The API returns `color_hex` per category and the backend seed now matches
 * these values, so prefer the API's colour and fall back to this map only when
 * a category has no colour or the app is rendering offline.
 *
 * Note: the design lists `Travel` where the backend has `Other`. `Other` keeps
 * a neutral grey; `Travel` is retained so a future backend category renders.
 */
export const categoryColors: Record<string, string> = {
  Groceries: '#6EE7B7',
  Dining: '#FDBA74',
  Transport: '#93C5FD',
  Entertainment: '#C4B5FD',
  Shopping: '#F9A8D4',
  Utilities: '#67E8F9',
  Health: '#BEF264',
  Travel: '#FDE68A',
  Other: '#9CA3AF',
};

export const FALLBACK_CATEGORY_COLOR = '#9CA3AF';

/** Resolve a category colour, preferring what the API returned. */
export function resolveCategoryColor(
  name?: string | null,
  apiColorHex?: string | null,
): string {
  if (apiColorHex) return apiColorHex;
  if (name && categoryColors[name]) return categoryColors[name];
  return FALLBACK_CATEGORY_COLOR;
}

/** OCR confidence indicators used on the Receipt Review screen. */
export const confidenceColors = {
  high: '#6EE7B7',
  low: '#FDBA74',
} as const;

export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};
