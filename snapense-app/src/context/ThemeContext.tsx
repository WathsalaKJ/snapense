import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

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

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: themes[theme],
      isSystem: override === null,
      setTheme,
      toggleTheme,
      useSystemTheme,
    }),
    [theme, override, setTheme, toggleTheme, useSystemTheme],
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
