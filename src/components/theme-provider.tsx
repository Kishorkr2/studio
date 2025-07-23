'use client';

import * as React from 'react';

type Theme = 'dark' | 'light' | 'system';

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
  // Initialize with the default theme to ensure server and client match on first render.
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);

  React.useEffect(() => {
    // On the client, after mounting, read the stored theme from localStorage
    // and update the state. This triggers a re-render with the user's saved theme.
    const storedTheme = (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    setTheme(storedTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let systemTheme: Theme = 'light';
    if (enableSystem) {
      systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    root.classList.add(effectiveTheme);
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
