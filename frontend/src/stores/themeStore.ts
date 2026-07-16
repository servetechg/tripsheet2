import { useState, useCallback } from 'react';
import { applyTheme, type ThemeMode } from '@/lib/theme';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    applyTheme('dark');
    return 'dark';
  });
  const toggleTheme = useCallback(() => {
    setThemeMode((m) => {
      const next: ThemeMode = m === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);
  return { themeMode, setThemeMode, toggleTheme };
}
