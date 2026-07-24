import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 8, md: 10, lg: 12, xl: 14, xxl: 16, pill: 999 } as const;

export const THEMES = {
  dark: {
    mode: 'dark' as const,
    bg: '#0B1220', card: '#111827', card2: '#1F2937', border: '#1E293B', border2: '#334155',
    gold: '#3B82F6', onGold: '#FFFFFF', goldLight: '#60A5FA', goldDim: '#1E40AF', goldBg: 'rgba(37,99,235,0.14)',
    text: '#F8FAFC', muted: '#94A3B8', muted2: '#CBD5E1',
    danger: '#DC2626', dangerBg: 'rgba(220,38,38,0.12)',
    success: '#16A34A', successBg: 'rgba(22,163,74,0.12)',
    warning: '#F59E0B', warningBg: 'rgba(245,158,11,0.12)',
    info: '#2563EB', infoBg: 'rgba(37,99,235,0.14)',
    purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.12)',
    white: '#ffffff', black: '#000000',
    skeleton: '#1E293B', skeletonShine: 'rgba(255,255,255,0.06)',
    infoTint: '#0F1B33', successTint: '#0C1F14', goldTint: '#0F1B33', inset: '#0A101C',
    strip: '#020617', stripText: '#ffffff', errTint: '#2A0F0F', errText: '#FCA5A5',
    overlay: 'rgba(2,6,23,0.78)',
    shadow: '0 4px 16px rgba(2,6,23,0.35)',
    shadowHover: '0 8px 28px rgba(2,6,23,0.45)',
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

export const FONT_UI =
  "'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif";
export const FONT_MONO = "'DM Mono','Courier New',monospace";

export const TYPE = {
  dashboardTitle: { fontSize: 28, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.2 },
  sectionTitle: { fontSize: 20, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.3 },
  cardTitle: { fontSize: 16, fontWeight: 500, lineHeight: 1.35 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
} as const;

export const page = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh', color: G.text,
});
export const pagePlain = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh',
});
export const pageCentered = (): CSSProperties => ({
  fontFamily: FONT_UI, background: G.bg, minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
});

export const inputBase = (): CSSProperties => ({
  width: '100%', background: G.card2, border: `1px solid ${G.border2}`,
  borderRadius: RADIUS.md, padding: '11px 14px', color: G.text, fontSize: 14,
  outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
});
export const labelBase = (): CSSProperties => ({
  display: 'block', fontSize: 12, letterSpacing: 0.3, color: G.muted,
  marginBottom: 6, fontWeight: 500,
});
