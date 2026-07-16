import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { G, RADIUS } from '@/lib/theme';

export type BtnVariant =
  | 'gold'
  | 'primary'
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
  variant = 'primary',
  full,
  size = 'md',
  children,
  style: sx,
  ...p
}: BtnProps) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 12 },
    md: { padding: '11px 18px', fontSize: 13 },
    lg: { padding: '13px 22px', fontSize: 14 },
  };
  const sz = sizes[size] || sizes.md;
  const primary: CSSProperties = {
    background: G.gold,
    color: G.onGold,
    border: 'none',
    fontWeight: 600,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    letterSpacing: 0.2,
    transition: 'transform .15s ease, box-shadow .15s ease, opacity .15s',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(37,99,235,0.28)',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    gold: primary,
    primary,
    outline: {
      background: G.card,
      color: G.muted2,
      border: `1px solid ${G.border2}`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
    },
    ghost: {
      background: G.goldBg,
      color: G.gold,
      border: `1px solid ${G.gold}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    },
    danger: {
      background: G.dangerBg,
      color: G.danger,
      border: `1px solid ${G.danger}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    },
    success: {
      background: G.successBg,
      color: G.success,
      border: `1px solid ${G.success}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    },
    info: {
      background: G.infoBg,
      color: G.info,
      border: `1px solid ${G.info}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    },
    purple: {
      background: G.purpleBg,
      color: G.purple,
      border: `1px solid ${G.purple}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    },
  };
  return (
    <button
      className="ts-btn"
      style={{
        ...(variants[variant] || variants.primary),
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
