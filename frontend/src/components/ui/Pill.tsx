import type { ReactNode } from 'react';
import { G, RADIUS } from '@/lib/theme';

export interface PillProps {
  color?: string;
  children?: ReactNode;
  small?: boolean;
}

export function Pill({ color = G.muted, children, small }: PillProps) {
  return (
    <span
      style={{
        background: color + '18',
        color,
        border: `1px solid ${color}28`,
        borderRadius: RADIUS.sm,
        padding: small ? '2px 8px' : '3px 10px',
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
