import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import { G } from '@/lib/theme';

export interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function Card({ children, style: sx, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
