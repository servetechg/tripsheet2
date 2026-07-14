import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import { G, RADIUS, SHADOW } from '@/lib/theme';

export interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  hover?: boolean;
}

export function Card({ children, style: sx, onClick, hover = true }: CardProps) {
  return (
    <div
      className={hover ? 'ts-card' : undefined}
      onClick={onClick}
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: RADIUS.lg,
        padding: '18px 20px',
        marginBottom: 14,
        boxShadow: SHADOW.sm,
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
