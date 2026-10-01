import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Light / dark theme.
 *
 * The choice is persisted in localStorage and applied as `data-theme` on <html>
 * rather than a `dark` class on <body>, so it also reaches portals (modals,
 * toasts) and Leaflet panes, which live outside the app root.
 *
 * The same resolution runs once inline in index.html before React boots; the
 * key and the browser-preference fallback are shared with that script so the
 * first paint matches the stored choice and there is no flash.
 */
const STORAGE_KEY = 'powerguide.theme';

const ThemeContext = createContext(null);

function prefersDark() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    // Private mode / storage disabled: fall back to the OS preference.
    return null;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B1524' : '#F6F7F9');
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredTheme() || (prefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode: the theme just resets on reload */
    }
  }, [theme]);

  /*
   * Only follow the OS while the user has never picked a theme themselves.
   * Once toggled, the explicit choice wins and stays put.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      if (readStoredTheme()) return;
      setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return context;
}
