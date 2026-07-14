import type { ReactNode } from 'react';
import { G, RADIUS, SHADOW } from '@/lib/theme';

export type StatItem = {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent: string;
  subtitle?: string;
  trend?: number;
};

export function StatCard({
  label,
  value,
  icon,
  accent,
  subtitle,
  trend,
  delay = 0,
}: StatItem & { delay?: number }) {
  const showTrend = typeof trend === 'number';
  const up = showTrend && trend >= 0;

  return (
    <div
      className="ts-card ts-stat-enter"
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: RADIUS.lg,
        padding: '16px 18px',
        boxShadow: SHADOW.sm,
        animationDelay: `${delay}ms`,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: G.muted,
              lineHeight: 1.3,
            }}
          >
            {label}
          </div>
          {showTrend && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: up ? G.success : G.danger,
                background: up ? G.successBg : G.dangerBg,
                padding: '2px 7px',
                borderRadius: RADIUS.pill,
              }}
            >
              {up ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: G.text,
            marginTop: 8,
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: G.muted, marginTop: 6 }}>{subtitle}</div>
        )}
      </div>

      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: accent + '14',
          color: accent,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export function StatsGrid({
  items,
  columns,
}: {
  items: StatItem[];
  columns?: number;
}) {
  const cols = columns || items.length;
  return (
    <div
      className="ts-stats-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 14,
        marginBottom: 20,
      }}
    >
      {items.map((item, i) => (
        <StatCard key={item.label} {...item} delay={i * 40} />
      ))}
    </div>
  );
}
