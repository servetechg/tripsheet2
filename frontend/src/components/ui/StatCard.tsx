import type { CSSProperties, ReactNode } from 'react';
import { G, RADIUS, TYPE } from '@/lib/theme';

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
        padding: '16px 18px',
        minWidth: 0,
        overflow: 'hidden',
        transition: 'transform .18s ease, border-color .18s ease',
        ...sx,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              ...TYPE.small,
              color: G.muted,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: G.text,
              letterSpacing: -0.4,
              lineHeight: 1.15,
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
              {subtitle && (
                <div style={{ ...TYPE.small, color: G.muted, lineHeight: 1.35 }}>
                  {subtitle}
                </div>
              )}
              {trend && (
                <span
                  style={{
                    ...TYPE.small,
                    fontWeight: 600,
                    color: trend.up === false ? G.danger : G.success,
                    background: (trend.up === false ? G.danger : G.success) + '18',
                    borderRadius: RADIUS.sm,
                    padding: '2px 8px',
                  }}
                >
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>

        {icon != null && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              background: `${color}14`,
              border: `1px solid ${color}28`,
              color,
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
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 12,
        marginBottom: 20,
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
