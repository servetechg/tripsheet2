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
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '8px 16px', fontSize: 14 },
    lg: { padding: '10px 20px', fontSize: 15 },
  };
  const sz = sizes[size] || sizes.md;
  const primary: CSSProperties = {
    background: G.gold,
    color: G.onGold,
    border: '1px solid transparent',
    fontWeight: 500,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    letterSpacing: -0.1,
    transition: 'all .15s ease',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    gold: primary,
    primary,
    outline: {
      background: 'transparent',
      color: G.text,
      border: `1px solid ${G.border2}`,
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
    },
    ghost: {
      background: 'transparent',
      color: G.text,
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'background .15s ease',
      whiteSpace: 'nowrap',
    },
    danger: {
      background: G.danger,
      color: '#fff',
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    },
    success: {
      background: G.success,
      color: '#fff',
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    },
    info: {
      background: G.info,
      color: '#fff',
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    },
    purple: {
      background: G.purple,
      color: '#fff',
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: -0.1,
      transition: 'all .15s ease',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
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
