import type { CSSProperties } from 'react';

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 7, md: 9, lg: 12, xl: 14, xxl: 18, pill: 20 } as const;

export const THEMES = {
  dark: {
    mode: 'dark' as const,
    bg: '#07070a', card: '#0f0f14', card2: '#14141a', border: '#1c1c24', border2: '#252530',
    gold: '#D4A017', onGold: '#000000', goldLight: '#f0c030', goldDim: '#7a5608', goldBg: 'rgba(212,160,23,0.08)',
    text: '#eeeef2', muted: '#8a8a9c', muted2: '#a8a8ba',
    danger: '#e0453a', dangerBg: 'rgba(224,69,58,0.08)',
    success: '#25a85a', successBg: 'rgba(37,168,90,0.08)',
    info: '#4a8ff5', infoBg: 'rgba(74,143,245,0.08)',
    purple: '#8b5cf6', purpleBg: 'rgba(139,92,246,0.08)',
    white: '#ffffff', black: '#000000',
    skeleton: '#1c1c24', skeletonShine: 'rgba(255,255,255,0.06)',
    infoTint: '#0a1a2a', successTint: '#0a1a0a', goldTint: '#1a1508', inset: '#0a0a0a',
    strip: '#000000', stripText: '#ffffff', errTint: '#1a0000', errText: '#f88',
    overlay: 'rgba(0,0,0,0.86)',
  },
  light: {
    mode: 'light' as const,
    bg: '#eef1f5', card: '#ffffff', card2: '#f5f7fa', border: '#e2e6ec', border2: '#cdd3dc',
    gold: '#b07a09', onGold: '#ffffff', goldLight: '#c99012', goldDim: '#8a5f06', goldBg: 'rgba(176,122,9,0.12)',
    text: '#1a1d24', muted: '#5c6472', muted2: '#3a4150',
    danger: '#c8352a', dangerBg: 'rgba(200,53,42,0.09)',
    success: '#12894a', successBg: 'rgba(18,137,74,0.10)',
    info: '#2166c4', infoBg: 'rgba(33,102,196,0.10)',
    purple: '#7040c9', purpleBg: 'rgba(112,64,201,0.10)',
    white: '#ffffff', black: '#000000',
    skeleton: '#e4e8ee', skeletonShine: 'rgba(0,0,0,0.045)',
    infoTint: '#eaf1fb', successTint: '#e8f5ee', goldTint: '#faf3e2', inset: '#f0f2f6',
    strip: '#1a1d24', stripText: '#ffffff', errTint: '#fdeceb', errText: '#c8352a',
    overlay: 'rgba(20,22,28,0.55)',
  },
} as const;

export type ThemeMode = keyof typeof THEMES;
export type ThemeTokens = (typeof THEMES)[ThemeMode];

export const G: ThemeTokens = { ...THEMES.dark };

export function applyTheme(mode: ThemeMode | string): void {
  Object.assign(G, THEMES[(mode as ThemeMode)] || THEMES.dark);
}

export const FONT_UI =
  "'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif";
export const FONT_MONO = "'DM Mono','Courier New',monospace";

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
  borderRadius: 9, padding: '12px 14px', color: G.text, fontSize: 13,
  outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', fontFamily: 'inherit',
});
export const labelBase = (): CSSProperties => ({
  display: 'block', fontSize: 10, letterSpacing: 2, color: G.muted,
  marginBottom: 5, textTransform: 'uppercase', fontWeight: 600,
});
