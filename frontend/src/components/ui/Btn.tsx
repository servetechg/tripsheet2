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
  className,
  ...p
}: BtnProps) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 12 },
    md: { padding: '10px 18px', fontSize: 14 },
    lg: { padding: '12px 22px', fontSize: 15 },
  };
  const sz = sizes[size] || sizes.md;
  const primary = {
    background: G.primary,
    color: G.onPrimary,
    border: 'none',
    fontWeight: 600,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    letterSpacing: 0.1,
    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)',
    whiteSpace: 'nowrap' as const,
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary,
    gold: primary,
    outline: {
      background: G.card,
      color: G.text,
      border: `1px solid ${G.border}`,
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    ghost: {
      background: G.primaryBg,
      color: G.primary,
      border: `1px solid transparent`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    danger: {
      background: G.dangerBg,
      color: G.danger,
      border: `1px solid ${G.danger}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    success: {
      background: G.successBg,
      color: G.success,
      border: `1px solid ${G.success}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    info: {
      background: G.infoBg,
      color: G.info,
      border: `1px solid ${G.info}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    purple: {
      background: G.purpleBg,
      color: G.purple,
      border: `1px solid ${G.purple}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
  };
  return (
    <button
      className={`ts-btn${className ? ` ${className}` : ''}`}
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
