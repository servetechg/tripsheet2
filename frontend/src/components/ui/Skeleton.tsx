import type { CSSProperties } from 'react';
import { G, RADIUS, SPACE } from '@/lib/theme';

export interface SkeletonProps {
  rows?: number;
  height?: number;
  style?: CSSProperties;
}

export function Skeleton({ rows = 3, height = 64, style }: SkeletonProps) {
  return (
    <div style={style}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: RADIUS.lg,
            marginBottom: SPACE.md,
            background: `linear-gradient(90deg, ${G.skeleton} 0%, ${G.skeletonShine} 50%, ${G.skeleton} 100%)`,
            backgroundSize: '600px 100%',
            animation: 'ts-shimmer 1.3s ease-in-out infinite',
            border: `1px solid ${G.border}`,
          }}
        />
      ))}
    </div>
  );
}
