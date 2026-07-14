import type { ReactNode } from 'react';
import { G } from '@/lib/theme';

export interface SectionTitleProps {
  children?: ReactNode;
  color?: string;
}

export function SectionTitle({ children, color }: SectionTitleProps) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: 3,
        color: color || G.gold,
        marginBottom: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
