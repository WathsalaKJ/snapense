/**
 * Spacing, radii and type scale.
 *
 * The app is laid out for a 390x844 frame (iPhone 14). These are the values
 * that actually recur across the screens rather than an invented scale.
 */

export * from './colors';

/** The frame the layout targets; used to scale where needed. */
export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

/** Recurring gap/padding steps from the design. */
export const spacing = {
  xxs: 3,
  xs: 4,
  sm: 6,
  md: 9,
  lg: 12,
  xl: 14,
  xxl: 18,
  xxxl: 20,
} as const;

/** Standard horizontal screen inset - `padding: … 18px` / `… 20px` dominate. */
export const screenPadding = 18;

/** Recurring border radii. */
export const radii = {
  chip: 100,
  card: 16,
  input: 14,
  tile: 10,
  sheet: 22,
  bar: 2,
} as const;

/** Font sizes, most-used first. */
export const fontSize = {
  micro: 8.5,
  tiny: 9.5,
  caption: 11,
  captionLg: 11.5,
  small: 12,
  smallLg: 12.5,
  body: 13,
  bodyLg: 13.5,
  base: 14,
  baseLg: 14.5,
  lg: 15,
  xl: 16,
  title: 19,
  display: 26,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** The design uses Inter throughout; system font is the fallback. */
export const fontFamily = undefined;

export const tabBarHeight = 84;
