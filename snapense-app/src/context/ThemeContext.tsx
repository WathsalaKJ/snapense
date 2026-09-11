import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { themes, type ThemeColors, type ThemeName } from '../theme/colors';

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  /** True when following the OS setting rather than an explicit choice. */
  isSystem: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  useSystemTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeName | null>(null);

  // The design's default block is the dark theme, so dark wins when the OS
  // reports no preference.
  const theme: ThemeName = override ?? (systemScheme === 'light' ? 'light' : 'dark');

  const setTheme = useCallback((next: ThemeName) => setOverride(next), []);
  const toggleTheme = useCallback(
    () => setOverride(theme === 'dark' ? 'light' : 'dark'),
    [theme],
  );
  const useSystemTheme = useCallback(() => setOverride(null), []);

  const colors = themes[theme];

  // Keeps the web-only autofill CSS override (fixAutofillStyles.ts) in sync
  // with the active theme - that override lives in a real <style> tag since
  // :-webkit-autofill can't be reached through RN's style system, so it
  // reads these custom properties instead of a color baked in at injection
  // time. No-op on native (no `document`).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--sn-autofill-bg', colors.bg);
    document.documentElement.style.setProperty('--sn-autofill-text', colors.text);
  }, [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors,
      isSystem: override === null,
      setTheme,
      toggleTheme,
      useSystemTheme,
    }),
    [theme, colors, override, setTheme, toggleTheme, useSystemTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }
  return context;
}
