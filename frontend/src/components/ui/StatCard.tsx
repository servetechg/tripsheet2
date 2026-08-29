import type { CSSProperties, ReactNode } from 'react';
import { G, RADIUS, TYPE } from '@/lib/theme';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: string;
  trend?: { label: string; up?: boolean };
  style?: CSSProperties;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  accent,
  trend,
  style: sx,
}: StatCardProps) {
  const color = accent || G.info;

  return (
    <div
      className="ts-stat-card"
      style={{
        position: 'relative',
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: RADIUS.lg,
        padding: '16px 20px',
        boxShadow: G.shadow,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
        ...sx,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          background: color,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              ...TYPE.small,
              color: G.text,
              fontWeight: 500,
              letterSpacing: -0.1,
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: G.text,
              letterSpacing: -0.5,
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </div>
          {(subtitle || trend) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                flexWrap: 'wrap',
              }}
            >
              {trend && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: trend.up === false ? G.danger : G.success,
                    background: (trend.up === false ? G.danger : G.success) + '15',
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  {trend.label}
                </span>
              )}
              {subtitle && (
                <div style={{ fontSize: 12, color: G.muted, lineHeight: 1.2 }}>
                  {subtitle}
                </div>
              )}
            </div>
          )}
        </div>

        {icon != null && (
          <div
            style={{
              color: G.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export type StatsGridProps = {
  children: ReactNode;
  /** Equal-width columns (same layout as before). Default 4. */
  columns?: number;
  style?: CSSProperties;
};

/** Equal-width stats row used across feature pages. */
export function StatsGrid({ children, columns = 4, style: sx }: StatsGridProps) {
  const w = useMediaQuery();
  let actualCols = columns;
  
  if (w < 640) actualCols = 1;
  else if (w < 850) actualCols = 2;
  else if (w < 1150) actualCols = Math.min(3, columns);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${actualCols}, minmax(0, 1fr))`,
        gap: 10,
        marginBottom: 20,
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
