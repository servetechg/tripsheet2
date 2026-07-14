/**
 * Extracts App.jsx into the TypeScript architecture.
 * Preserves all JSX/logic; adds imports + light typing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const lines = fs.readFileSync(path.join(src, 'App.jsx'), 'utf8').split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}
function write(rel, content) {
  const full = path.join(src, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n');
  console.log('✓', rel);
}

// Strip "function Name(...) {" and trailing "}" — keep body
function fnBody(start, end) {
  const block = slice(start, end);
  const firstBrace = block.indexOf('{');
  const lastBrace = block.lastIndexOf('}');
  return block.slice(firstBrace + 1, lastBrace).replace(/^\n/, '').replace(/\n$/, '');
}

function stripConstFn(start, end) {
  // For: const X = (...) => ( ... );  or const X = (...) => { ... };
  return slice(start, end);
}

// ═══════════════════════════════════════════════════════════════════════════
// INFRA
// ═══════════════════════════════════════════════════════════════════════════

write('vite-env.d.ts', `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`);

write('styles/tokens.css', `:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-xxl: 32px;
  --radius-sm: 7px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-xxl: 18px;
  --radius-pill: 20px;
  --font-ui: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  --font-mono: 'DM Mono', 'Courier New', monospace;
}
`);

write('styles/global.css', `@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button,
input,
select,
textarea {
  font-family: inherit;
}

@keyframes ts-shimmer {
  0% { background-position: -300px 0; }
  100% { background-position: 300px 0; }
}
`);

write('lib/uid.ts', `export const uid = (): string => Math.random().toString(36).slice(2, 9);
`);

write('lib/format.ts', `export const blank = (v: unknown): boolean => !v || !String(v).trim();

export const fmt = (n: unknown, c = 'CAD'): string =>
  \`\${c} \${parseFloat(String(n ?? 0)).toFixed(2)}\`;
`);

write('lib/queryKeys.ts', `export const queryKeys = {
  companies: ['companies'] as const,
  users: ['users'] as const,
  loads: ['loads'] as const,
  assets: ['assets'] as const,
  sheets: ['sheets'] as const,
  manifests: ['manifests'] as const,
  carrierProfiles: ['carrierProfiles'] as const,
  driverDocs: ['driverDocs'] as const,
  invites: ['invites'] as const,
};
`);

write('lib/api.ts', `const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { BASE as API_BASE };
`);

write(
  'lib/theme.ts',
  `import type { CSSProperties } from 'react';

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
  width: '100%', background: G.card2, border: \`1px solid \${G.border2}\`,
  borderRadius: 9, padding: '12px 14px', color: G.text, fontSize: 13,
  outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', fontFamily: 'inherit',
});
export const labelBase = (): CSSProperties => ({
  display: 'block', fontSize: 10, letterSpacing: 2, color: G.muted,
  marginBottom: 5, textTransform: 'uppercase', fontWeight: 600,
});
`
);

write(
  'data/seed.ts',
  `import type { Company, User, Asset, Load, CarrierProfile } from '@tripsheet/shared';

export type SeedUser = User & { password: string };

export const SEED_COMPANIES: Company[] = [
  { id: 'c1', name: 'MKX Transport', shortName: 'MKX', address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8', tagline: 'MORE EFFICIENT', active: true },
];

export const SEED_USERS: SeedUser[] = [
  { id: 'u1', name: 'Super Admin', role: 'superadmin', email: 'admin@tripsheet.io', password: 'admin123', companyId: null },
  { id: 'u2', name: 'MKX Admin', role: 'company_admin', email: 'admin@mkx.ca', password: 'mkx123', companyId: 'c1' },
  { id: 'u3', name: 'Divyam Chopra', role: 'driver', email: 'divyam@mkx.ca', password: 'driver123', companyId: 'c1' },
];

export const SEED_ASSETS: Asset[] = [
  { id: 'a1', companyId: 'c1', type: 'truck', unitNo: '32054', year: '2022', make: 'Kenworth', model: 'T680', vin: '1XKWDB0X0NJ123456', plate: 'AB-32054', status: 'active' },
  { id: 'a2', companyId: 'c1', type: 'truck', unitNo: '32055', year: '2021', make: 'Peterbilt', model: '579', vin: '1XPWDB9X0ND654321', plate: 'AB-32055', status: 'active' },
  { id: 'a3', companyId: 'c1', type: 'trailer', unitNo: 'DV1767', year: '2020', make: 'Stoughton', model: '53ft Dry Van', vin: '1DW1A5324LA000001', plate: 'AB-DV1767', status: 'active' },
  { id: 'a4', companyId: 'c1', type: 'trailer', unitNo: 'MKX002', year: '2019', make: 'Wabash', model: '53ft Reefer', vin: '1JJV532B8KL000002', plate: 'AB-MKX002', status: 'active' },
];

export const SEED_LOADS: Load[] = [
  { id: 'L001', companyId: 'c1', driverId: 'u3', truckId: 'a1', trailerId: 'a3', status: 'in_transit', origin: 'Calgary, AB', destination: 'Saint-Eustache, QC', pickupTime: 'May 20 08:00', eta: 'May 22 18:00', lat: 51.2, lng: -108.5, tripNo: '34320', lastUpdate: '2 min ago', speed: 95, heading: 'E', truckNo: '32054', trailerNo: 'DV1767' },
];

export const SEED_CARRIER_PROFILES: CarrierProfile[] = [
  { companyId: 'c1', cbsaCarrierCode: 'MKX1', scacCode: 'MKXT', dotNumber: '12345678', csnNumber: '', fastLane: false },
];
`
);

write(
  'features/manifests/constants.ts',
  `import type { ManifestStatus } from '@tripsheet/shared';

export const EM_STATUS: Record<ManifestStatus, { label: string; color: string }> = {
  draft: { label: 'DRAFT', color: '#666' },
  submitted: { label: 'SUBMITTED', color: '#3b82f6' },
  accepted: { label: 'ACCEPTED', color: '#2f9e58' },
  rejected: { label: 'REJECTED', color: '#e53e3e' },
  cancelled: { label: 'CANCELLED', color: '#888' },
};

export const CA_PORTS = [
  { code: '0407', name: 'Coutts, AB' },
  { code: '0409', name: 'Sweetgrass, MT/Coutts' },
  { code: '0411', name: 'Carway, AB' },
  { code: '0431', name: 'North Portal, SK' },
  { code: '0453', name: 'Emerson, MB' },
  { code: '0474', name: 'Windsor, ON' },
  { code: '0476', name: 'Sarnia, ON' },
  { code: '0489', name: 'Fort Erie, ON' },
  { code: '0493', name: 'Queenston, ON' },
  { code: '0498', name: 'Cornwall, ON' },
  { code: '0610', name: 'Lacolle, QC' },
  { code: '0615', name: 'St-Bernard-de-Lacolle' },
  { code: '0708', name: 'Pacific Hwy, BC' },
  { code: '0711', name: 'Huntingdon, BC' },
];

export const US_PORTS = [
  { code: '3401', name: 'Blaine, WA' },
  { code: '3404', name: 'Sumas, WA' },
  { code: '3505', name: 'Sweetgrass, MT' },
  { code: '3301', name: 'Portal, ND' },
  { code: '3601', name: 'Pembina, ND' },
  { code: '3801', name: 'Noyes, MN' },
  { code: '3901', name: 'Port Huron, MI' },
  { code: '3902', name: 'Detroit, MI' },
  { code: '0901', name: 'Buffalo, NY' },
  { code: '0712', name: 'Champlain, NY' },
  { code: '2304', name: 'Laredo, TX' },
  { code: '2506', name: 'Otay Mesa, CA' },
];
`
);

write(
  'lib/docTypes.ts',
  `import { DRIVER_DOC_TYPES as SHARED, DISPATCH_REQUIRED_DOCS, PAY_TYPES as SHARED_PAY } from '@tripsheet/shared';
import type { DriverDocTypeId, PayTypeId } from '@tripsheet/shared';

const DOC_ICONS: Record<DriverDocTypeId, string> = {
  contract: '📄',
  license: '🪪',
  abstract: '📋',
  medical: '🏥',
  fast_card: '🛂',
  twic: '🔐',
  hazmat: '☢️',
  cvor: '🚛',
  criminal: '✅',
  sin_ssn: '🔒',
  void_cheque: '🏦',
  other: '📎',
};

export const DRIVER_DOC_TYPES = SHARED.map((d) => ({
  ...d,
  icon: DOC_ICONS[d.id],
}));

export { DISPATCH_REQUIRED_DOCS };

const PAY_ICONS: Record<PayTypeId, string> = {
  per_mile: '🛣️',
  hourly: '⏱️',
  per_load: '📦',
  percentage: '📊',
  salary: '💰',
};

export const PAY_TYPES = SHARED_PAY.map((p) => ({
  ...p,
  icon: PAY_ICONS[p.id],
}));

export const DOC_STATUS_COLOR: Record<string, string> = {
  uploaded: '#2f9e58',
  expired: '#e53e3e',
  expiring_soon: '#D4A017',
  missing: '#666',
};
`
);

write(
  'hooks/useMediaQuery.ts',
  `import { useState, useEffect } from 'react';

/** Window width hook (was useW). */
export function useMediaQuery(): number {
  const [w, setW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

/** @deprecated alias */
export const useW = useMediaQuery;
`
);

write(
  'hooks/useFakeLoad.ts',
  `import { useState, useEffect } from 'react';

export function useFakeLoad(key: unknown, delay = 400): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, [key, delay]);
  return loading;
}
`
);

write(
  'hooks/usePersisted.ts',
  `import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Persistence hook — localStorage not available in some sandboxes,
 * so this falls back to in-memory React state (resets on full reload).
 */
export function usePersisted<T>(
  _key: string,
  seed: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [val, setVal] = useState<T>(seed);
  const set: Dispatch<SetStateAction<T>> = (updater) => {
    setVal((prev) =>
      typeof updater === 'function'
        ? (updater as (p: T) => T)(prev)
        : updater,
    );
  };
  return [val, set];
}
`
);

write(
  'stores/themeStore.ts',
  `import { useState, useCallback } from 'react';
import { applyTheme, type ThemeMode } from '@/lib/theme';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  applyTheme(themeMode);
  const toggleTheme = useCallback(() => {
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);
  return { themeMode, setThemeMode, toggleTheme };
}
`
);

write(
  'stores/authStore.ts',
  `import { useState } from 'react';
import type { SeedUser } from '@/data/seed';

export type SessionUser = SeedUser;

export function useSession() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const logout = () => setSession(null);
  return { session, setSession, logout };
}
`
);

console.log('Infra files written. Continuing with components...');

// Helper: wrap extracted arrow/function component with imports + export
function componentFile(rel, imports, exportName, bodyLines) {
  write(rel, `${imports}\n\n${bodyLines}\n`);
}

// We'll extract raw slices and wrap them carefully in a second pass via writing
// full files with the original function converted to export function.

function extractAndExport(rel, imports, start, end, name) {
  let code = slice(start, end);
  // Convert function Foo( to export function Foo(
  code = code.replace(new RegExp(`^function ${name}\\b`), `export function ${name}`);
  code = code.replace(new RegExp(`^const ${name}\\s*=`), `export const ${name} =`);
  write(rel, `${imports}\n\n${code}\n`);
}

const R = "import React, { useState, useRef, useEffect } from 'react';";
const theme = `import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered, inputBase, labelBase } from '@/lib/theme';`;
const fmt = `import { blank, fmt } from '@/lib/format';\nimport { uid } from '@/lib/uid';`;

// UI components
write(
  'components/ui/Inp.tsx',
  `import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';

export interface InpProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}

export function Inp({ label, style: sx, inputStyle, ...p }: InpProps) {
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <input style={{ ...inputBase(), ...inputStyle }} {...p} />
    </div>
  );
}
`
);

write(
  'components/ui/Sel.tsx',
  `import type { CSSProperties, SelectHTMLAttributes, ReactNode } from 'react';
import { inputBase, labelBase } from '@/lib/theme';

export interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Sel({ label, children, style: sx, ...p }: SelProps) {
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <select style={{ ...inputBase(), appearance: 'none', cursor: 'pointer' }} {...p}>
        {children}
      </select>
    </div>
  );
}
`
);

write(
  'components/ui/Pill.tsx',
  `import type { ReactNode } from 'react';

export interface PillProps {
  color: string;
  children?: ReactNode;
  small?: boolean;
}

export function Pill({ color, children, small }: PillProps) {
  return (
    <span
      style={{
        background: color + '18',
        color,
        border: \`1px solid \${color}33\`,
        borderRadius: 20,
        padding: small ? '2px 8px' : '3px 10px',
        fontSize: small ? 9 : 10,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
`
);

write(
  'components/ui/Divider.tsx',
  `import { G } from '@/lib/theme';

export interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 4 }}>
      {label && (
        <span
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: G.muted,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: G.border }} />
    </div>
  );
}
`
);

write(
  'components/ui/Btn.tsx',
  `import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { G } from '@/lib/theme';

export type BtnVariant =
  | 'gold'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'info'
  | 'purple';

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  full?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  style?: CSSProperties;
}

export function Btn({
  variant = 'gold',
  full,
  size = 'md',
  children,
  style: sx,
  ...p
}: BtnProps) {
  const sizes = {
    sm: { padding: '7px 14px', fontSize: 11 },
    md: { padding: '11px 20px', fontSize: 12 },
    lg: { padding: '14px 24px', fontSize: 14 },
  };
  const sz = sizes[size] || sizes.md;
  const variants: Record<BtnVariant, CSSProperties> = {
    gold: {
      background: G.gold, color: G.onGold, border: 'none', fontWeight: 800,
      borderRadius: 9, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
      transition: 'opacity .15s', whiteSpace: 'nowrap',
    },
    outline: {
      background: 'transparent', color: G.muted2, border: \`1px solid \${G.border2}\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', transition: 'all .15s', whiteSpace: 'nowrap',
    },
    ghost: {
      background: G.goldBg, color: G.gold, border: \`1px solid \${G.gold}44\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    danger: {
      background: G.dangerBg, color: G.danger, border: \`1px solid \${G.danger}33\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    success: {
      background: G.successBg, color: G.success, border: \`1px solid \${G.success}33\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    info: {
      background: G.infoBg, color: G.info, border: \`1px solid \${G.info}33\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    purple: {
      background: G.purpleBg, color: G.purple, border: \`1px solid \${G.purple}33\`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
  };
  return (
    <button
      style={{
        ...(variants[variant] || variants.gold),
        ...sz,
        ...(full ? { width: '100%', textAlign: 'center' as const } : {}),
        ...sx,
      }}
      {...p}
    >
      {children}
    </button>
  );
}
`
);

write(
  'components/ui/Card.tsx',
  `import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import { G } from '@/lib/theme';

export interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function Card({ children, style: sx, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: G.card,
        border: \`1px solid \${G.border}\`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
`
);

write(
  'components/ui/SectionTitle.tsx',
  `import type { ReactNode } from 'react';
import { G } from '@/lib/theme';

export interface SectionTitleProps {
  children?: ReactNode;
  color?: string;
}

export function SectionTitle({ children, color }: SectionTitleProps) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: 3,
        color: color || G.gold,
        marginBottom: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
`
);

write(
  'components/ui/Skeleton.tsx',
  `import { G, RADIUS, SPACE } from '@/lib/theme';

export interface SkeletonProps {
  rows?: number;
  height?: number;
}

export function Skeleton({ rows = 3, height = 64 }: SkeletonProps) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: RADIUS.lg,
            marginBottom: SPACE.md,
            background: \`linear-gradient(90deg, \${G.skeleton} 0%, \${G.skeletonShine} 50%, \${G.skeleton} 100%)\`,
            backgroundSize: '600px 100%',
            animation: 'ts-shimmer 1.3s ease-in-out infinite',
            border: \`1px solid \${G.border}\`,
          }}
        />
      ))}
    </div>
  );
}
`
);

write(
  'components/ui/G2.tsx',
  `import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface G2Props {
  children?: ReactNode;
  cols?: number;
}

export function G2({ children, cols = 2 }: G2Props) {
  const w = useMediaQuery();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: w < 600 ? '1fr' : \`repeat(\${cols},1fr)\`,
        gap: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
`
);

write(
  'components/ui/index.ts',
  `export { Btn } from './Btn';
export { Card } from './Card';
export { Inp } from './Inp';
export { Sel } from './Sel';
export { Pill } from './Pill';
export { Divider } from './Divider';
export { SectionTitle } from './SectionTitle';
export { Skeleton } from './Skeleton';
export { G2 } from './G2';
`
);

write(
  'components/feedback/ErrBox.tsx',
  `import { G } from '@/lib/theme';

export interface ErrBoxProps {
  msg?: string | null;
}

export function ErrBox({ msg }: ErrBoxProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: G.dangerBg,
        border: \`1px solid \${G.danger}33\`,
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 12,
        color: G.danger,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>⚠️</span>
      <span>{msg}</span>
    </div>
  );
}
`
);

write(
  'components/feedback/OkBox.tsx',
  `import { G } from '@/lib/theme';

export interface OkBoxProps {
  msg?: string | null;
}

export function OkBox({ msg }: OkBoxProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: G.successBg,
        border: \`1px solid \${G.success}33\`,
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 12,
        color: G.success,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>✓</span>
      <span>{msg}</span>
    </div>
  );
}
`
);

write(
  'components/feedback/Err.tsx',
  `import { G } from '@/lib/theme';

export interface ErrProps {
  msg?: string | null;
}

export function Err({ msg }: ErrProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: G.dangerBg,
        border: \`1px solid \${G.danger}33\`,
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 12,
        color: G.danger,
        marginBottom: 14,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      ⚠️ {msg}
    </div>
  );
}
`
);

write(
  'components/feedback/Toast.tsx',
  `import { useState, useEffect } from 'react';
import { G, SPACE, RADIUS, FONT_UI } from '@/lib/theme';
import { uid } from '@/lib/uid';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
}

type ToastHandler = (toast: ToastItem) => void;

let _toastSubscribers: ToastHandler[] = [];

export function notify(msg: string, type: ToastType = 'success'): void {
  const toast: ToastItem = { id: uid(), msg, type };
  _toastSubscribers.forEach((fn) => fn(toast));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    const handler: ToastHandler = (toast) => {
      setToasts((p) => [...p, toast]);
      setTimeout(
        () => setToasts((p) => p.filter((t) => t.id !== toast.id)),
        3200,
      );
    };
    _toastSubscribers.push(handler);
    return () => {
      _toastSubscribers = _toastSubscribers.filter((h) => h !== handler);
    };
  }, []);
  if (!toasts.length) return null;
  const ICONS: Record<string, string> = {
    success: '✓',
    error: '⚠️',
    info: 'ℹ️',
  };
  return (
    <div
      style={{
        position: 'fixed',
        bottom: SPACE.xl,
        right: SPACE.xl,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
        maxWidth: 340,
      }}
    >
      {toasts.map((t) => {
        const c =
          t.type === 'error' ? G.danger : t.type === 'info' ? G.info : G.success;
        return (
          <div
            key={t.id}
            style={{
              background: G.card,
              border: \`1px solid \${c}55\`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              borderRadius: RADIUS.md,
              padding: '12px 14px',
              fontSize: 12,
              fontFamily: FONT_UI,
              color: G.text,
              display: 'flex',
              alignItems: 'flex-start',
              gap: SPACE.sm,
            }}
          >
            <span style={{ color: c, fontWeight: 800, flexShrink: 0 }}>
              {ICONS[t.type] || ICONS.success}
            </span>
            <span style={{ flex: 1 }}>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
`
);

console.log('UI + feedback done');
