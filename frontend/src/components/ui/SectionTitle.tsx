import type { ReactNode } from 'react';
import { G, TYPE } from '@/lib/theme';

export interface SectionTitleProps {
  children?: ReactNode;
  color?: string;
}

export function SectionTitle({ children, color }: SectionTitleProps) {
  return (
    <div
      style={{
        ...TYPE.sectionTitle,
        color: color || G.text,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}
