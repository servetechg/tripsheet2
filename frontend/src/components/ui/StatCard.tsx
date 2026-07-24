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
        borderRadius: RADIUS.xl,
        padding: '16px 16px 14px',
        boxShadow: G.shadow,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        ...sx,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}66)`,
        }}
      />

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
              letterSpacing: 0.2,
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: G.text,
              letterSpacing: -0.45,
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
                    background: (trend.up === false ? G.danger : G.success) + '14',
                    borderRadius: RADIUS.pill,
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
              width: 42,
              height: 42,
              borderRadius: 12,
              background: `linear-gradient(145deg, ${color}22, ${color}0D)`,
              border: `1px solid ${color}33`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 4px 12px ${color}18`,
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
        gap: 10,
        marginBottom: 20,
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
