import type { ReactNode } from 'react';
import { G, TYPE } from '@/lib/theme';

export interface SectionTitleProps {
  children?: ReactNode;
  color?: string;
  large?: boolean;
}

export function SectionTitle({ children, color, large }: SectionTitleProps) {
  if (large) {
    return (
      <div
        style={{
          ...TYPE.sectionTitle,
          color: color || G.text,
          marginBottom: 14,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: 0.6,
        color: color || G.muted,
        marginBottom: 14,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
