/**
 * Web-only responsive breakpoints. `useWindowDimensions` (unlike
 * `Dimensions.get`) re-renders on browser resize, so this reacts live.
 * `isWideWeb` is always false on native, so gating layout on it never
 * touches the phone app.
 */

import { Platform, useWindowDimensions } from 'react-native';

export const breakpoints = {
  tablet: 600,
  desktop: 1024,
} as const;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  return {
    width,
    height,
    isWeb,
    isWideWeb: isWeb && width >= breakpoints.tablet,
    isDesktopWeb: isWeb && width >= breakpoints.desktop,
  };
}

/**
 * Single source of truth for "should this render the desktop-grade web
 * layout" (sidebar nav, dashboard grid, table/grid screens). Everything
 * gated on this is additive and only ever true when `Platform.OS === 'web'`
 * at a wide-enough viewport - native and narrower web windows are untouched.
 */
export function useIsDesktopWeb(): boolean {
  return useResponsive().isDesktopWeb;
}
