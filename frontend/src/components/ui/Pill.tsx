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
        background: color + '18',
        color,
        border: `1px solid ${color}33`,
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
