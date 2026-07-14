import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
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
      background: 'transparent', color: G.muted2, border: `1px solid ${G.border2}`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', transition: 'all .15s', whiteSpace: 'nowrap',
    },
    ghost: {
      background: G.goldBg, color: G.gold, border: `1px solid ${G.gold}44`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    danger: {
      background: G.dangerBg, color: G.danger, border: `1px solid ${G.danger}33`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    success: {
      background: G.successBg, color: G.success, border: `1px solid ${G.success}33`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    info: {
      background: G.infoBg, color: G.info, border: `1px solid ${G.info}33`,
      fontWeight: 700, borderRadius: 9, cursor: 'pointer', letterSpacing: 1,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    purple: {
      background: G.purpleBg, color: G.purple, border: `1px solid ${G.purple}33`,
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
