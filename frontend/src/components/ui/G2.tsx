import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface G2Props {
  children?: ReactNode;
  cols?: number;
}

export function G2({ children, cols = 2 }: G2Props) {
  const w = useMediaQuery();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: w < 600 ? '1fr' : `repeat(${cols},1fr)`,
        gap: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
