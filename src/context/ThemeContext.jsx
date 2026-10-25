import { createContext, useContext, useMemo } from 'react';

/**
 * Theme: permanently dark.
 *
 * The app is standardised on the Outages workspace look (#03041A canvas), so
 * `data-theme="dark"` is applied unconditionally on <html> - including portals
 * (modals, toasts) and Leaflet panes, which live outside the app root. The
 * context keeps its original shape (`theme`, `isDark`, `setTheme`, `toggleTheme`)
 * so existing consumers keep working; the toggle is a no-op.
 */
const ThemeContext = createContext(null);

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#03041A');
}

applyTheme();

export function ThemeProvider({ children }) {
  const value = useMemo(
    () => ({ theme: 'dark', isDark: true, setTheme: applyTheme, toggleTheme: applyTheme }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return context;
}
