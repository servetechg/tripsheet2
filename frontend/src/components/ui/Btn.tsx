import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Icons } from './Icons';

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
    sm: { padding: '0 12px', fontSize: 12, minHeight: 32 },
    md: { padding: '0 16px', fontSize: 13, minHeight: 38 },
    lg: { padding: '0 20px', fontSize: 14, minHeight: 40 },
  };
  const sz = sizes[size] || sizes.md;
  const primary: CSSProperties = {
    background: G.gold,
    color: G.onGold,
    border: 'none',
    fontWeight: 600,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    letterSpacing: 0,
    transition: 'background .15s ease, opacity .15s ease',
    whiteSpace: 'nowrap',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    gold: primary,
    primary,
    outline: {
      background: 'transparent',
      color: G.muted2,
      border: `1px solid ${G.border}`,
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      transition: 'border-color .15s ease, color .15s ease, background .15s ease',
      whiteSpace: 'nowrap',
    },
    ghost: {
      background: 'transparent',
      color: G.muted2,
      border: '1px solid transparent',
      fontWeight: 500,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      transition: 'background .15s ease, color .15s ease',
      whiteSpace: 'nowrap',
    },
    danger: {
      background: G.dangerBg,
      color: G.danger,
      border: `1px solid ${G.danger}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    },
    success: {
      background: G.successBg,
      color: G.success,
      border: `1px solid ${G.success}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    },
    info: {
      background: G.infoBg,
      color: G.info,
      border: `1px solid ${G.info}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    },
    purple: {
      background: G.purpleBg,
      color: G.purple,
      border: `1px solid ${G.purple}33`,
      fontWeight: 600,
      borderRadius: RADIUS.md,
      cursor: 'pointer',
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    },
  };
  const isPrimary = variant === 'primary' || variant === 'gold';
  return (
    <button
      className={isPrimary ? 'ts-btn ts-btn-primary' : 'ts-btn'}
      style={{
        ...(variants[variant] || variants.primary),
        ...sz,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(full ? { width: '100%' } : {}),
        ...sx,
      }}
      {...p}
    >
      {children}
    </button>
  );
}

export function BackButton({
  onClick,
  label = 'BACK',
  style: sx,
  className,
  ...rest
}: {
  onClick?: () => void;
  label?: ReactNode;
  style?: CSSProperties;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${G.border}`,
        color: G.muted2,
        borderRadius: RADIUS.md,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all .15s ease',
        ...sx,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = G.gold;
        e.currentTarget.style.color = G.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = G.border;
        e.currentTarget.style.color = G.muted2;
      }}
      className={className}
      {...rest}
    >
      {Icons.arrowLeft({ size: 15, color: 'currentColor' })}
      <span>{label}</span>
    </button>
  );
}
