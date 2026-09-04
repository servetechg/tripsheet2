import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 6, md: 8, lg: 10, xl: 12, xxl: 14, pill: 999 } as const;

export const THEMES = {
  dark: {
    mode: 'dark' as const,
    bg: '#101625',
    sidebar: '#151C2C',
    card: '#151C2C',
    card2: '#1A2234',
    border: '#1E293B',
    border2: '#2A3448',
    gold: '#3D8CFF',
    onGold: '#FFFFFF',
    goldLight: '#5BA0FF',
    goldDim: '#2F6FD4',
    goldBg: 'rgba(61, 140, 255, 0.12)',
    navActive: '#1A2332',
    navActiveText: '#FFFFFF',
    text: '#FFFFFF',
    muted: '#8A94AD',
    muted2: '#A8B0C4',
    danger: '#F87171',
    dangerBg: 'rgba(248, 113, 113, 0.12)',
    success: '#34D399',
    successBg: 'rgba(52, 211, 153, 0.12)',
    warning: '#FBBF24',
    warningBg: 'rgba(251, 191, 36, 0.12)',
    info: '#38BDF8',
    infoBg: 'rgba(56, 189, 248, 0.12)',
    purple: '#A78BFA',
    purpleBg: 'rgba(167, 139, 250, 0.12)',
    white: '#ffffff',
    black: '#000000',
    skeleton: '#1A2234',
    skeletonShine: 'rgba(255,255,255,0.04)',
    infoTint: '#121820',
    successTint: '#0C1A14',
    goldTint: '#121820',
    inset: '#121820',
    strip: '#101625',
    stripText: '#FFFFFF',
    errTint: '#2A1414',
    errText: '#F87171',
    overlay: 'rgba(5, 8, 15, 0.78)',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.28)',
    shadowHover: '0 4px 16px rgba(0, 0, 0, 0.32)',
  },
  light: {
    mode: 'light' as const,
    bg: '#F5F7FB',
    sidebar: '#FFFFFF',
    card: '#FFFFFF',
    card2: '#F8FAFD',
    border: '#E2E8F0',
    border2: '#CBD5E1',
    gold: '#3D8CFF',
    onGold: '#FFFFFF',
    goldLight: '#5BA0FF',
    goldDim: '#2F6FD4',
    goldBg: 'rgba(61, 140, 255, 0.10)',
    navActive: 'rgba(61, 140, 255, 0.10)',
    navActiveText: '#0F172A',
    text: '#0F172A',
    muted: '#64748B',
    muted2: '#475569',
    danger: '#E05252',
    dangerBg: 'rgba(224, 82, 82, 0.08)',
    success: '#22A06B',
    successBg: 'rgba(34, 160, 107, 0.08)',
    warning: '#D97706',
    warningBg: 'rgba(217, 119, 6, 0.08)',
    info: '#0EA5E9',
    infoBg: 'rgba(14, 165, 233, 0.08)',
    purple: '#7C3AED',
    purpleBg: 'rgba(124, 58, 237, 0.08)',
    white: '#ffffff',
    black: '#000000',
    skeleton: '#E2E8F0',
    skeletonShine: 'rgba(15, 23, 42, 0.04)',
    infoTint: '#EFF6FF',
    successTint: '#F0FDF4',
    goldTint: '#EFF6FF',
    inset: '#F1F5F9',
    strip: '#0F172A',
    stripText: '#ffffff',
    errTint: '#FEF2F2',
    errText: '#DC2626',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    shadowHover: '0 4px 16px rgba(15, 23, 42, 0.08)',
  },
} as const;

export type ThemeMode = keyof typeof THEMES;
export type ThemeTokens = (typeof THEMES)[ThemeMode];

export const G: ThemeTokens = { ...THEMES.dark };

function syncCssVars(t: ThemeTokens): void {
  const root = document.documentElement.style;
  root.setProperty('--color-primary', t.gold);
  root.setProperty('--color-primary-hover', t.goldLight);
  root.setProperty('--color-bg', t.bg);
  root.setProperty('--color-sidebar', t.sidebar);
  root.setProperty('--color-card', t.card);
  root.setProperty('--color-surface', t.card2);
  root.setProperty('--color-text', t.text);
  root.setProperty('--color-muted', t.muted);
  root.setProperty('--color-muted-2', t.muted2);
  root.setProperty('--color-border', t.border);
  root.setProperty('--color-nav-active', t.navActive);
  root.setProperty('--color-success', t.success);
  root.setProperty('--color-warning', t.warning);
  root.setProperty('--color-danger', t.danger);
  root.setProperty('--color-info', t.info);
}

export function applyTheme(mode: ThemeMode | string): void {
  const t = THEMES[(mode as ThemeMode)] || THEMES.dark;
  Object.assign(G, t);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme =
      (mode as ThemeMode) in THEMES ? mode : 'dark';
    syncCssVars(t);
  }
}

export const FONT_UI =
  "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const FONT_MONO = "'DM Mono', 'Courier New', monospace";

export const TYPE = {
  dashboardTitle: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 },
  sectionTitle: { fontSize: 20, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.3 },
  cardTitle: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: 12, fontWeight: 400, lineHeight: 1.45 },
} as const;

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
  background: G.card2,
  border: `1px solid ${G.border}`,
  borderRadius: RADIUS.md,
  padding: '11px 14px',
  minHeight: 42,
  color: G.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  WebkitAppearance: 'none',
  fontFamily: 'inherit',
  transition: 'border-color .15s ease, box-shadow .15s ease',
});
export const labelBase = (): CSSProperties => ({
  display: 'block',
  fontSize: 13,
  letterSpacing: 0,
  color: G.muted2,
  marginBottom: 6,
  fontWeight: 500,
  cursor: 'pointer',
});
