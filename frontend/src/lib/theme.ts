import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 10, md: 12, lg: 14, xl: 16, xxl: 20, pill: 999 } as const;

/** Shared shell metrics so sidebar brand + top header align */
export const SHELL = {
  navWidth: 248,
  headerHeight: 72,
  headerPadX: 24,
} as const;

/** Soft elevation shadows (Material Design 3–inspired) */
export const SHADOW = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
  lg: '0 10px 28px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
} as const;

export const THEMES = {
  dark: {
    mode: 'dark' as const,
    bg: '#0B1220',
    card: '#111827',
    card2: '#1A2332',
    border: '#1E293B',
    border2: '#334155',
    gold: '#3B82F6',
    onGold: '#FFFFFF',
    goldLight: '#60A5FA',
    goldDim: '#1E40AF',
    goldBg: 'rgba(37, 99, 235, 0.14)',
    primary: '#3B82F6',
    secondary: '#1E40AF',
    onPrimary: '#FFFFFF',
    primaryBg: 'rgba(37, 99, 235, 0.14)',
    text: '#F1F5F9',
    muted: '#94A3B8',
    muted2: '#CBD5E1',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.12)',
    success: '#16A34A',
    successBg: 'rgba(22, 163, 74, 0.12)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.12)',
    purple: '#6366F1',
    purpleBg: 'rgba(99, 102, 241, 0.12)',
    white: '#ffffff',
    black: '#000000',
    skeleton: '#1E293B',
    skeletonShine: 'rgba(255,255,255,0.06)',
    infoTint: '#0F1B33',
    successTint: '#0F2418',
    goldTint: '#0F1B33',
    inset: '#0A101C',
    strip: '#0F172A',
    stripText: '#ffffff',
    errTint: '#2A1212',
    errText: '#FCA5A5',
    overlay: 'rgba(0,0,0,0.72)',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
  },
  light: {
    mode: 'light' as const,
    bg: '#F8FAFC',
    card: '#FFFFFF',
    card2: '#F1F5F9',
    border: '#E2E8F0',
    border2: '#CBD5E1',
    gold: '#2563EB',
    onGold: '#FFFFFF',
    goldLight: '#3B82F6',
    goldDim: '#1E40AF',
    goldBg: 'rgba(37, 99, 235, 0.08)',
    primary: '#2563EB',
    secondary: '#1E40AF',
    onPrimary: '#FFFFFF',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    text: '#0F172A',
    muted: '#64748B',
    muted2: '#475569',
    danger: '#DC2626',
    dangerBg: 'rgba(220, 38, 38, 0.08)',
    success: '#16A34A',
    successBg: 'rgba(22, 163, 74, 0.08)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.08)',
    info: '#2563EB',
    infoBg: 'rgba(37, 99, 235, 0.08)',
    purple: '#4F46E5',
    purpleBg: 'rgba(79, 70, 229, 0.08)',
    white: '#ffffff',
    black: '#000000',
    skeleton: '#E2E8F0',
    skeletonShine: 'rgba(0,0,0,0.04)',
    infoTint: '#EFF6FF',
    successTint: '#F0FDF4',
    goldTint: '#EFF6FF',
    inset: '#F1F5F9',
    strip: '#0F172A',
    stripText: '#ffffff',
    errTint: '#FEF2F2',
    errText: '#DC2626',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: SHADOW.md,
  },
} as const;

export type ThemeMode = keyof typeof THEMES;
export type ThemeTokens = (typeof THEMES)[ThemeMode];

export const G: ThemeTokens = { ...THEMES.light };

export function applyTheme(mode: ThemeMode | string): void {
  const theme = THEMES[(mode as ThemeMode)] || THEMES.light;
  Object.assign(G, theme);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-success', theme.success);
    root.style.setProperty('--color-warning', theme.warning);
    root.style.setProperty('--color-danger', theme.danger);
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-card', theme.card);
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-muted', theme.muted);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty(
      '--table-header-bg',
      theme.mode === 'light' ? '#F8FAFC' : theme.card2,
    );
    root.style.setProperty(
      '--table-stripe-bg',
      theme.mode === 'light' ? '#FAFBFC' : theme.inset,
    );
    root.style.setProperty(
      '--table-hover-bg',
      theme.mode === 'light' ? '#EFF6FF' : theme.goldBg,
    );
  }
}

export const FONT_UI =
  "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
export const FONT_MONO = "'DM Mono', 'Courier New', monospace";

export const TYPE = {
  dashboardTitle: { fontSize: 28, fontWeight: 700, letterSpacing: -0.4 } as const,
  sectionTitle: { fontSize: 20, fontWeight: 600, letterSpacing: -0.2 } as const,
  cardTitle: { fontSize: 16, fontWeight: 500 } as const,
  body: { fontSize: 14, fontWeight: 400 } as const,
  small: { fontSize: 12, fontWeight: 400 } as const,
};

export const page = (): CSSProperties => ({
  fontFamily: FONT_UI,
  background: G.bg,
  minHeight: '100vh',
  color: G.text,
});
export const pagePlain = (): CSSProperties => ({
  fontFamily: FONT_UI,
  background: G.bg,
  minHeight: '100vh',
});
export const pageCentered = (): CSSProperties => ({
  fontFamily: FONT_UI,
  background: G.bg,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
});

export const inputBase = (): CSSProperties => ({
  width: '100%',
  background: G.card,
  border: `1px solid ${G.border}`,
  borderRadius: RADIUS.md,
  padding: '11px 14px',
  color: G.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  WebkitAppearance: 'none',
  fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
});
export const labelBase = (): CSSProperties => ({
  display: 'block',
  fontSize: 12,
  letterSpacing: 0.2,
  color: G.muted,
  marginBottom: 6,
  fontWeight: 500,
});
