import type { ReactNode } from 'react';
import { G } from '@/lib/theme';

export interface PillProps {
  color?: string;
  children?: ReactNode;
  small?: boolean;
}

export function Pill({ color = G.muted, children, small }: PillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: color + '10',
        color: color,
        border: `1px solid ${color}20`,
        borderRadius: 4,
        padding: small ? '2px 6px' : '4px 8px',
        fontSize: small ? 11 : 12,
        fontWeight: 500,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: small ? 6 : 8,
          height: small ? 6 : 8,
          borderRadius: '50%',
          background: color,
        }}
      />
      {children}
    </span>
  );
}
