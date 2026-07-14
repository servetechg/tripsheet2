import type { ReactNode } from 'react';
import { RADIUS } from '@/lib/theme';

export interface PillProps {
  color: string;
  children?: ReactNode;
  small?: boolean;
}

export function Pill({ color, children, small }: PillProps) {
  return (
    <span
      style={{
        background: color + '14',
        color,
        border: `1px solid ${color}28`,
        borderRadius: RADIUS.pill,
        padding: small ? '3px 9px' : '4px 11px',
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  );
}
