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
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div
          style={{
            ...TYPE.small,
            minWidth: 0,
            color: G.muted,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={label}
        >
          {label}
        </div>

        {icon != null && (
          <div
            style={{
              width: 38,
              height: 38,
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

      <div
        style={{
          width: '100%',
          marginTop: 8,
          fontSize: 'clamp(18px, 2vw, 24px)',
          fontWeight: 700,
          color: G.text,
          letterSpacing: -0.4,
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere',
        }}
        title={String(value)}
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
            <div
              style={{
                ...TYPE.small,
                color: G.muted,
                lineHeight: 1.35,
                maxWidth: '100%',
                overflowWrap: 'anywhere',
              }}
              title={subtitle}
            >
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
                whiteSpace: 'nowrap',
              }}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
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
      className={`ts-stats-grid ts-stats-grid--${columns}`}
      data-cols={columns}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${columns >= 6 ? '180px' : '210px'}), 1fr))`,
        gap: 12,
        marginBottom: 20,
        ...sx,
      }}
    >
      {children}
    </div>
  );
}
