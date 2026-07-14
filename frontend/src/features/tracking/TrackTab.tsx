import { useState, useEffect, useRef } from 'react';
import { G } from '@/lib/theme';
import { Card, Pill, Icons, StatsGrid } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { loadsApi } from '@/lib/api';
import { MapView } from './MapView';

export function TrackTab({
  company,
  loads,
  setLoads,
  users,
  statusColor,
  apiEnabled,
  refreshAll,
}: any) {
  const [sel, setSel] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const loadsRef = useRef(loads);
  loadsRef.current = loads;

  useEffect(() => {
    let cancelled = false;

    const localSim = () => {
      setLoads((p: any[]) =>
        p.map((l) =>
          l.status !== 'in_transit'
            ? l
            : {
                ...l,
                lat: l.lat + (Math.random() - 0.3) * 0.08,
                lng: l.lng + (Math.random() + 0.1) * 0.12,
                speed: Math.floor(88 + Math.random() * 20),
                lastUpdate: 'just now',
              },
        ),
      );
      setTick((t) => t + 1);
    };

    const tickOnce = async () => {
      if (!apiEnabled) {
        localSim();
        return;
      }

      const inTransit = loadsRef.current.filter(
        (l: any) => l.status === 'in_transit',
      );
      try {
        await Promise.all(
          inTransit.map((l: any) =>
            loadsApi.simulateTrack(l.id).catch(() => null),
          ),
        );
        if (cancelled) return;

        if (company?.id) {
          const active = await loadsApi.active(company.id);
          if (cancelled) return;
          setLoads((prev: any[]) => {
            const byId = new Map(active.map((a: any) => [a.id, a]));
            return prev.map((l) => byId.get(l.id) || l);
          });
        } else {
          await refreshAll?.();
        }
        setTick((t) => t + 1);
      } catch {
        if (!cancelled) localSim();
      }
    };

    const t = setInterval(() => {
      void tickOnce();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [apiEnabled, company?.id, setLoads, refreshAll]);

  const w = useMediaQuery();
  const viewing = sel ? loads.find((l: any) => l.id === sel) || null : null;
  const inTransit = loads.filter((l: any) => l.status === 'in_transit').length;
  const assigned = loads.filter((l: any) => l.status === 'assigned').length;
  const delivered = loads.filter((l: any) => l.status === 'delivered').length;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: G.text }}>Live Tracking</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
          Monitor trucks in transit and open a map view.
        </div>
      </div>

      <StatsGrid
        items={[
          {
            label: 'In Transit',
            value: inTransit,
            accent: G.warning || G.gold,
            icon: Icons.gpsFixed({ size: 20 }),
          },
          {
            label: 'Assigned',
            value: assigned,
            accent: G.info,
            icon: Icons.schedule({ size: 20 }),
          },
          {
            label: 'Delivered',
            value: delivered,
            accent: G.success,
            icon: Icons.checkCircle({ size: 20 }),
          },
          {
            label: 'Total Loads',
            value: loads.length,
            accent: G.primary,
            icon: Icons.localShipping({ size: 20 }),
          },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewing && w >= 900 ? '1fr 1.5fr' : '1fr',
          gap: 14,
        }}
      >
        <div>
          {loads.length === 0 && (
            <Card style={{ textAlign: 'center', padding: 50 }} hover={false}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: G.primaryBg,
                  color: G.primary,
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto',
                }}
              >
                {Icons.location({ size: 24 })}
              </div>
              <div style={{ color: G.muted, marginTop: 10, fontSize: 14 }}>
                No loads yet. Assign loads from Dispatch.
              </div>
            </Card>
          )}
          {loads.length > 0 &&
            loads.filter((l: any) => l.status === 'in_transit').length === 0 && (
              <div
                style={{
                  background: `${G.gold}11`,
                  border: `1px solid ${G.gold}33`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 14,
                  fontSize: 13,
                  color: G.gold,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {Icons.schedule({ size: 18 })}
                No loads currently in transit. Start a load from Dispatch to
                track it live.
              </div>
            )}
          {loads.map((l: any) => {
            const driver = users.find((u: any) => u.id === l.driverId);
            const isSel = sel === l.id;
            return (
              <div
                key={l.id}
                onClick={() => setSel(isSel ? null : l.id)}
                style={{
                  background: G.card,
                  border: `1px solid ${isSel ? G.gold : G.border}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  cursor: 'pointer',
                  transition: 'border .2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontWeight: 800, color: G.gold }}>
                        {l.id}
                      </span>
                      <Pill color={statusColor[l.status] || G.muted}>
                        {l.status.replace('_', ' ').toUpperCase()}
                      </Pill>
                      {l.status === 'in_transit' && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: G.success,
                            display: 'inline-block',
                            boxShadow: `0 0 6px ${G.success}`,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {driver?.name || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: G.muted }}>
                      🚛 {l.truckNo || '—'} · {l.origin} → {l.destination}
                    </div>
                    {l.status === 'in_transit' && (
                      <div
                        style={{ fontSize: 11, color: G.gold, marginTop: 4 }}
                      >
                        {l.speed} km/h · Updated {l.lastUpdate}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 11, color: G.muted, textAlign: 'right' }}
                  >
                    {l.pickupTime || ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {viewing && (
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.border}`,
              borderRadius: 14,
              overflow: 'hidden',
              position: w >= 900 ? 'sticky' : 'relative',
              top: 80,
            }}
          >
            <MapView load={viewing} users={users} loads={loads} tick={tick} />
          </div>
        )}
      </div>
    </div>
  );
}
