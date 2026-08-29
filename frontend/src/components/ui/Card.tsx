import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import { G, RADIUS } from '@/lib/theme';

export interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  padded?: boolean;
}

export function Card({ children, style: sx, onClick, padded = true }: CardProps) {
  return (
    <div
      className={onClick ? 'ts-card ts-card-clickable' : 'ts-card'}
      onClick={onClick}
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: RADIUS.lg,
        padding: padded ? '16px' : 0,
        marginBottom: 12,
        boxShadow: G.shadow,
        transition: 'box-shadow .15s ease, transform .15s ease',
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
