import { useState } from 'react';
import { applyTheme, type ThemeMode } from '@/lib/theme';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  applyTheme(themeMode);
  const toggleTheme = () => {
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  };
  return { themeMode, setThemeMode, toggleTheme };
}
