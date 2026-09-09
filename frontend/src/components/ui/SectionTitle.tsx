import type { ReactNode, CSSProperties } from 'react';
import { G, TYPE } from '@/lib/theme';

export interface SectionTitleProps {
  children?: ReactNode;
  color?: string;
  large?: boolean;
  style?: CSSProperties;
}

export function SectionTitle({ children, color, large, style }: SectionTitleProps) {
  if (large) {
    return (
      <div
        style={{
          ...TYPE.sectionTitle,
          color: color || G.text,
          marginBottom: 14,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: 0.4,
        color: color || G.muted,
        marginBottom: 14,
        fontWeight: 600,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
