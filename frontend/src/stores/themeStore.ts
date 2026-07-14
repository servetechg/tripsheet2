import { useState, useCallback } from 'react';
import { applyTheme, type ThemeMode } from '@/lib/theme';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  applyTheme(themeMode);
  const toggleTheme = useCallback(() => {
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);
  return { themeMode, setThemeMode, toggleTheme };
}
