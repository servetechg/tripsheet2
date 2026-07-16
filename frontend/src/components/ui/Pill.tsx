import type { ReactNode } from 'react';

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
        borderRadius: 999,
        padding: small ? '3px 9px' : '4px 11px',
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
