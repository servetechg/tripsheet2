import type { CSSProperties } from 'react';
import { G, FONT_MONO, RADIUS } from '@/lib/theme';
import { Btn, Card, Pill, Icons, RouteFromTo } from '@/components/ui';
import { formatDisplayDateTime } from '@/lib/formFields';
import type { Load } from '@tripsheet/shared';

const STATUS_COLOR: Record<string, string> = {
  assigned: G.info,
  in_transit: G.gold,
  delivered: G.success,
  cancelled: G.danger,
};

function loadMargin(l: {
  customerRate?: number | string | null;
  fuelSurcharge?: number | string | null;
  accessorials?: number | string | null;
  detentionHours?: number | string | null;
  detentionRate?: number | string | null;
  carrierCost?: number | string | null;
}) {
  const rev =
    Number(l.customerRate || 0) +
    Number(l.fuelSurcharge || 0) +
    Number(l.accessorials || 0) +
    Number(l.detentionHours || 0) * Number(l.detentionRate || 0);
  const cost = Number(l.carrierCost || 0);
  return { rev, cost, margin: rev - cost };
}

export type DriverLoadCardProps = {
  load: Load;
  /** Active assignment vs completed history row */
  mode?: 'active' | 'history';
  loadStatusBusy?: boolean;
  canStart?: boolean;
  canComplete?: boolean;
  onStart?: () => void;
  onDeliver?: () => void;
  style?: CSSProperties;
};

export function DriverLoadCard({
  load: l,
  mode = 'active',
  loadStatusBusy = false,
  canStart = false,
  canComplete = false,
  onStart,
  onDeliver,
  style,
}: DriverLoadCardProps) {
  const sc = STATUS_COLOR[l.status] || G.muted;
  const { rev, cost, margin } = loadMargin(l);
  const stops = Array.isArray(l.stops) ? l.stops : [];
  const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
  const isActive = mode === 'active';

  return (
    <Card style={{ padding: '12px 14px', ...style }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
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
              fontSize: 16,
              fontWeight: 800,
              color: G.gold,
              letterSpacing: -0.2,
            }}
          >
            Trip #{l.tripNo || '—'}
          </div>
          <Pill color={sc}>{l.status.replace('_', ' ').toUpperCase()}</Pill>
          {l.status === 'in_transit' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: RADIUS.pill,
                background: G.successBg,
                color: G.success,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: G.success,
                  boxShadow: `0 0 6px ${G.success}`,
                }}
              />
              LIVE
            </span>
          )}
        </div>
        {isActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {l.status === 'assigned' && canStart && (
              <Btn
                size="sm"
                loading={loadStatusBusy}
                loadingLabel="Starting…"
                disabled={loadStatusBusy}
                onClick={onStart}
              >
                ▶ Start
              </Btn>
            )}
            {l.status === 'in_transit' && canComplete && (
              <Btn
                variant="success"
                size="sm"
                loading={loadStatusBusy}
                loadingLabel="Delivering…"
                disabled={loadStatusBusy}
                onClick={onDeliver}
              >
                ✓ Deliver
              </Btn>
            )}
          </div>
        )}
      </div>

      {isActive && (
        <details style={{ marginTop: 4, fontSize: 10, color: G.muted }}>
          <summary
            style={{ cursor: 'pointer', color: G.muted2, listStylePosition: 'inside' }}
          >
            Technical details
          </summary>
          <div
            title={l.id}
            style={{
              marginTop: 4,
              fontFamily: FONT_MONO,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Load ID · {l.id}
          </div>
        </details>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 8,
          fontSize: 11,
          color: G.muted2,
          lineHeight: 1.4,
        }}
      >
        {l.pickupTime && (
          <span>
            <strong style={{ color: G.muted, fontWeight: 700 }}>Pickup</strong>{' '}
            <span style={{ color: G.text }}>
              {formatDisplayDateTime(l.pickupTime)}
            </span>
          </span>
        )}
        {l.eta && (
          <span>
            <strong style={{ color: G.gold, fontWeight: 700 }}>ETA</strong>{' '}
            <span style={{ color: G.text }}>{formatDisplayDateTime(l.eta)}</span>
          </span>
        )}
        {l.status === 'in_transit' && l.speed != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: G.muted, fontWeight: 700 }}>Speed</strong>
            <span style={{ color: G.text }}>{l.speed} km/h</span>
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {Icons.truck({ size: 13, color: G.muted })}
          {l.truckNo ? `#${l.truckNo}` : 'No truck'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {Icons.trailer({ size: 13, color: G.muted })}
          {l.trailerNo ? `#${l.trailerNo}` : 'No trailer'}
        </span>
      </div>

      <RouteFromTo
        compact
        origin={l.origin}
        destination={l.destination}
        style={{ marginTop: 8 }}
      />

      {l.notes && (
        <div
          style={{
            fontSize: 11,
            color: G.muted,
            marginTop: 8,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          {l.notes}
        </div>
      )}

      {(rev !== 0 || cost !== 0 || l.miles) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
            gap: 7,
            marginTop: 10,
          }}
        >
          {[
            { label: 'Revenue', value: money(rev), color: G.text },
            { label: 'Cost', value: money(cost), color: G.text },
            {
              label: 'Margin',
              value: money(margin),
              color: margin >= 0 ? G.success : G.danger,
            },
            {
              label: 'Miles',
              value: l.miles ? `${l.miles}` : '—',
              color: G.text,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                minWidth: 0,
                padding: '7px 10px',
                border: `1px solid ${G.border}`,
                borderRadius: RADIUS.md,
                background: G.card2,
              }}
            >
              <div
                style={{
                  color: G.muted,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 2,
                  color: item.color,
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.25,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {stops.length > 0 && (
        <div
          style={{
            marginTop: 8,
            color: G.muted,
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          Stops: {stops.map((s) => s.location || s).join(' → ')}
        </div>
      )}
    </Card>
  );
}
