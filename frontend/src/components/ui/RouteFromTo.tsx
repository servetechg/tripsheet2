import type { CSSProperties } from 'react';
import { G, RADIUS } from '@/lib/theme';

export type RouteFromToProps = {
  origin?: string | null;
  destination?: string | null;
  compact?: boolean;
  style?: CSSProperties;
};

export function RouteFromTo({
  origin,
  destination,
  compact = false,
  style: sx,
}: RouteFromToProps) {
  const from = origin?.trim() || 'Unknown origin';
  const to = destination?.trim() || 'Unknown destination';

  const stop = (kind: 'from' | 'to', label: string, value: string) => {
    const accent = kind === 'from' ? G.info : G.success;
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? 8 : 10 }}>
        <div
          style={{
            width: compact ? 18 : 22,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          <span
            style={{
              width: compact ? 8 : 10,
              height: compact ? 8 : 10,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 0 3px ${accent}33`,
            }}
          />
          {kind === 'from' && (
            <span
              style={{
                width: 2,
                flex: 1,
                minHeight: compact ? 12 : 18,
                marginTop: 4,
                background: G.border2,
                borderRadius: 2,
              }}
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            paddingBottom: kind === 'from' ? (compact ? 6 : 10) : 0,
          }}
        >
          <div
            style={{
              display: 'inline-block',
              marginBottom: compact ? 2 : 4,
              padding: compact ? '1px 6px' : '2px 7px',
              borderRadius: RADIUS.sm,
              background: kind === 'from' ? G.infoBg : G.successBg,
              color: accent,
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              letterSpacing: 0.6,
            }}
          >
            {label}
          </div>
          <div
            title={value}
            style={{
              color: G.text,
              fontSize: compact ? 12 : 13,
              fontWeight: 650,
              lineHeight: compact ? 1.35 : 1.45,
              overflowWrap: 'anywhere',
            }}
          >
            {value}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: compact ? 8 : 10,
        padding: compact ? '8px 10px 7px' : '12px 12px 10px',
        borderRadius: RADIUS.md,
        border: `1px solid ${G.border}`,
        background: G.card2,
        ...sx,
      }}
    >
      {stop('from', 'Pickup', from)}
      {stop('to', 'Delivery', to)}
    </div>
  );
}
