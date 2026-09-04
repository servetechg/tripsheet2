import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 10, xxl: 12, pill: 999 } as const;

export const THEMES = {
  dark: {
    mode: 'dark' as const,
    bg: '#111622', card: '#1B2433', card2: '#232D3F', border: '#2A3649', border2: '#36465D',
    gold: '#3B82F6', onGold: '#FFFFFF', goldLight: '#60A5FA', goldDim: '#1D4ED8', goldBg: 'rgba(59,130,246,0.15)',
    text: '#FFFFFF', muted: '#8B97A8', muted2: '#CBD5E1',
    danger: '#EF4444', dangerBg: 'rgba(239,68,68,0.12)',
    success: '#10B981', successBg: 'rgba(16,185,129,0.12)',
    warning: '#F59E0B', warningBg: 'rgba(245,158,11,0.12)',
    info: '#3B82F6', infoBg: 'rgba(59,130,246,0.12)',
    purple: '#8B5CF6', purpleBg: 'rgba(139,92,246,0.12)',
    white: '#ffffff', black: '#000000',
    skeleton: '#2A3649', skeletonShine: 'rgba(255,255,255,0.04)',
    infoTint: '#172554', successTint: '#022C22', goldTint: '#172554', inset: '#0F1522',
    strip: '#0F1522', stripText: '#ffffff', errTint: '#450A0A', errText: '#FCA5A5',
    overlay: 'rgba(11,15,25,0.8)',
    shadow: '0 4px 12px rgba(0,0,0,0.3)',
    shadowHover: '0 8px 24px rgba(0,0,0,0.4)',
  },
  light: {
    mode: 'light' as const,
    bg: '#F8FAFC', card: '#FFFFFF', card2: '#F1F5F9', border: '#E2E8F0', border2: '#CBD5E1',
    gold: '#2563EB', onGold: '#FFFFFF', goldLight: '#3B82F6', goldDim: '#1E40AF', goldBg: 'rgba(37,99,235,0.08)',
    text: '#0F172A', muted: '#64748B', muted2: '#475569',
    danger: '#DC2626', dangerBg: 'rgba(220,38,38,0.08)',
    success: '#16A34A', successBg: 'rgba(22,163,74,0.08)',
    warning: '#F59E0B', warningBg: 'rgba(245,158,11,0.10)',
    info: '#2563EB', infoBg: 'rgba(37,99,235,0.08)',
    purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.08)',
    white: '#ffffff', black: '#000000',
    skeleton: '#E2E8F0', skeletonShine: 'rgba(15,23,42,0.04)',
    infoTint: '#EFF6FF', successTint: '#F0FDF4', goldTint: '#EFF6FF', inset: '#F1F5F9',
    strip: '#0F172A', stripText: '#ffffff', errTint: '#FEF2F2', errText: '#DC2626',
    overlay: 'rgba(15,23,42,0.45)',
    shadow: '0 4px 16px rgba(15,23,42,0.06)',
    shadowHover: '0 10px 28px rgba(15,23,42,0.10)',
  },
} as const;

export type ThemeMode = keyof typeof THEMES;
export type ThemeTokens = (typeof THEMES)[ThemeMode];

export const G: ThemeTokens = { ...THEMES.dark };

export function applyTheme(mode: ThemeMode | string): void {
  Object.assign(G, THEMES[(mode as ThemeMode)] || THEMES.dark);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = (mode as ThemeMode) in THEMES ? mode : 'dark';
  }
}

export const FONT_UI = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const FONT_MONO = "'DM Mono', 'Courier New', monospace";

export const TYPE = {
  dashboardTitle: { fontSize: 24, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.2 },
  sectionTitle: { fontSize: 18, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.3 },
  cardTitle: { fontSize: 14, fontWeight: 600, lineHeight: 1.4, letterSpacing: -0.1 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: 13, fontWeight: 400, lineHeight: 1.4, color: G.muted },
} as const;

export const page = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh', color: G.text,
  WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
});
export const pagePlain = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh',
  WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
});
export const pageCentered = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
});

export const inputBase = (): CSSProperties => ({
  width: '100%', background: G.card, border: `1px solid ${G.border}`,
  borderRadius: RADIUS.md, padding: '10px 12px', color: G.text, fontSize: 14,
  outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
});
export const labelBase = (): CSSProperties => ({
  display: 'block', fontSize: 13, color: G.text,
  marginBottom: 6, fontWeight: 500, letterSpacing: -0.1,
});
