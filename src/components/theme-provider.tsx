
'use client';

import * as React from 'react';
import { THEMES } from './theme-preset-selector';

type Theme = 'dark' | 'light' | 'system' | typeof THEMES[number]['id'];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext =
  React.createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  attribute = 'class',
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });

  React.useEffect(() => {
    const root = window.document.documentElement;

    // Remove all theme classes first
    root.classList.remove('light', 'dark', ...THEMES.map(t => t.id));

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    // Check if the theme is a preset or a mode
    const isPreset = THEMES.some(t => t.id === effectiveTheme);

    if (isPreset) {
      root.classList.add(effectiveTheme as string);
    } else {
      root.classList.add(effectiveTheme);
    }
  }, [theme, enableSystem]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
