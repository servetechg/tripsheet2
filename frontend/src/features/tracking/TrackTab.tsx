import { useState, useEffect, useRef } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Card, Pill, StatCard, StatsGrid, Icons, RouteFromTo } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatDisplayDateTime } from '@/lib/formFields';
import { loadsApi } from '@/lib/api';
import { MapView } from './MapView';
import type { TrackTabProps } from '@/types/tabs';

export function TrackTab({
  company,
  loads,
  setLoads,
  users,
  statusColor,
  apiEnabled,
  refreshAll,
}: TrackTabProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadsRef = useRef(loads);
  loadsRef.current = loads;

  useEffect(() => {
    let cancelled = false;

    const localSim = () => {
      setLoads((p) =>
        p.map((l) =>
          l.status !== 'in_transit'
            ? l
            : {
                ...l,
                lat: (l.lat ?? 0) + (Math.random() - 0.3) * 0.08,
                lng: (l.lng ?? 0) + (Math.random() + 0.1) * 0.12,
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
        (l) => l.status === 'in_transit',
      );
      try {
        await Promise.all(
          inTransit.map((l) =>
            loadsApi.simulateTrack(l.id).catch(() => null),
          ),
        );
        if (cancelled) return;

        if (company?.id) {
          const active = await loadsApi.active(company.id);
          if (cancelled) return;
          setLoads((prev) => {
            const byId = new Map(active.map((a) => [a.id, a]));
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
  const viewing = sel ? loads.find((l) => l.id === sel) || null : null;

  return (
    <div>
      <StatsGrid>
        <StatCard
          label="In Transit"
          value={loads.filter((l) => l.status === 'in_transit').length}
          subtitle="Live on route"
          accent={G.warning}
          icon={Icons.track({ size: 20, color: G.warning })}
        />
        <StatCard
          label="Assigned"
          value={loads.filter((l) => l.status === 'assigned').length}
          subtitle="Waiting to depart"
          accent={G.info}
          icon={Icons.assigned({ size: 20, color: G.info })}
        />
        <StatCard
          label="Delivered"
          value={loads.filter((l) => l.status === 'delivered').length}
          subtitle="Completed trips"
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
        />
        <StatCard
          label="Total Loads"
          value={loads.length}
          subtitle="All statuses"
          accent={G.gold}
          icon={Icons.dispatch({ size: 20, color: G.gold })}
        />
      </StatsGrid>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewing && w >= 900 ? '1fr 1.5fr' : '1fr',
          gap: 14,
        }}
      >
        <div>
          {loads.length === 0 && (
            <Card style={{ textAlign: 'center', padding: 50 }}>
              <div>{Icons.track({ size: 36, color: G.muted })}</div>
              <div style={{ color: G.muted, marginTop: 10 }}>
                No loads yet. Assign loads from Dispatch.
              </div>
            </Card>
          )}
          {loads.length > 0 &&
            loads.filter((l) => l.status === 'in_transit').length === 0 && (
              <div
                style={{
                  background: `${G.gold}11`,
                  border: `1px solid ${G.gold}33`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 14,
                  fontSize: 11,
                  color: G.gold,
                }}
              >
                No loads currently in transit. Start a load from Dispatch to
                track it live.
              </div>
            )}
          {loads.map((l) => {
            const driver = users.find((u) => u.id === l.driverId);
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
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
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
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: G.gold,
                          }}
                        >
                          {l.tripNo ? `Trip #${l.tripNo}` : 'Unnumbered load'}
                        </span>
                        <Pill color={statusColor[l.status] || G.muted}>
                          {l.status.replace('_', ' ').toUpperCase()}
                        </Pill>
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
                      {l.pickupTime && (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: RADIUS.md,
                            border: `1px solid ${G.border}`,
                            background: G.inset,
                            fontSize: 10,
                            color: G.muted,
                            lineHeight: 1.35,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              marginBottom: 2,
                            }}
                          >
                            Scheduled pickup
                          </div>
                          <div style={{ color: G.text, fontWeight: 600, fontSize: 11 }}>
                            {formatDisplayDateTime(l.pickupTime)}
                          </div>
                        </div>
                      )}
                    </div>

                    <RouteFromTo origin={l.origin} destination={l.destination} />

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: `1px solid ${G.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          color: G.text,
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 600,
                          }}
                        >
                          {Icons.driver({ size: 14, color: G.gold })}
                          {driver?.name || 'Unknown driver'}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: G.muted2,
                          }}
                        >
                          {Icons.truck({ size: 14, color: G.muted })}
                          {l.truckNo ? `Unit #${l.truckNo}` : 'No truck assigned'}
                        </span>
                      </div>
                      {l.status === 'in_transit' && (
                        <span style={{ fontSize: 11, color: G.gold, fontWeight: 600 }}>
                          {l.speed} km/h · {l.lastUpdate || 'Updating…'}
                        </span>
                      )}
                      {isSel && (
                        <span style={{ fontSize: 11, color: G.muted }}>
                          Map open
                        </span>
                      )}
                    </div>
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
