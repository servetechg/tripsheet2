import { useState } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, SectionTitle, G2, Icons, StatsGrid } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { loadsApi, driversApi } from '@/lib/api';

export function DispatchTab({
  company,
  loads,
  setLoads,
  drivers,
  trucks,
  trailers,
  users,
  statusColor,
  onTrack,
  onEManifest,
  driverDocs = [],
  apiEnabled,
  refreshAll,
}: any) {
  const [show, setShow] = useState(false);
  const [editLoad, setEditLoad] = useState<any>(null);
  const [docErr, setDocErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    driverId: '',
    truckId: '',
    trailerId: '',
    origin: '',
    destination: '',
    pickupTime: '',
    eta: '',
    tripNo: '',
    notes: '',
  });
  const upd = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const resetForm = () => {
    setF({
      driverId: '',
      truckId: '',
      trailerId: '',
      origin: '',
      destination: '',
      pickupTime: '',
      eta: '',
      tripNo: '',
      notes: '',
    });
    setEditLoad(null);
    setShow(false);
    setDocErr('');
  };
  const openEdit = (l: any) => {
    setF({
      driverId: l.driverId || '',
      truckId: l.truckId || '',
      trailerId: l.trailerId || '',
      origin: l.origin || '',
      destination: l.destination || '',
      pickupTime: l.pickupTime || '',
      eta: l.eta || '',
      tripNo: l.tripNo || '',
      notes: l.notes || '',
    });
    setEditLoad(l);
    setShow(true);
  };

  const DISPATCH_REQUIRED = ['license', 'abstract', 'medical'];
  const checkDriverDocs = (driverId: string) => {
    const dd = (driverDocs || []).filter(
      (d: any) => d.driverId === driverId && d.status !== 'expired',
    );
    return DISPATCH_REQUIRED.filter(
      (id) => !dd.find((d: any) => d.type === id),
    );
  };

  const assertDispatchReady = async (driverId: string) => {
    if (apiEnabled) {
      try {
        const driver = drivers.find((d: any) => d.id === driverId);
        const recordId = driver?.driverRecordId || driverId;
        const res = await driversApi.dispatchReady(recordId);
        if (!res.ready) return res.missing;
      } catch {
        // fall through to local docs check
      }
    }
    return checkDriverDocs(driverId);
  };

  const payloadFromForm = () => {
    const truck = trucks.find((t: any) => t.id === f.truckId);
    const trailer = trailers.find((t: any) => t.id === f.trailerId);
    return {
      ...f,
      truckNo: truck?.unitNo || '',
      trailerNo: trailer?.unitNo || '',
    };
  };

  const save = async () => {
    if (blank(f.driverId) || blank(f.origin) || blank(f.destination)) return;
    if (!editLoad) {
      const missing = await assertDispatchReady(f.driverId);
      if (missing.length > 0) {
        const labels = missing
          .map(
            (id: string) =>
              DRIVER_DOC_TYPES.find((d) => d.id === id)?.label || id,
          )
          .join(', ');
        setDocErr(`Cannot dispatch — driver is missing: ${labels}`);
        return;
      }
    }
    setDocErr('');
    const body = payloadFromForm();

    try {
      setBusy(true);
      if (apiEnabled) {
        if (editLoad) {
          await loadsApi.update(editLoad.id, body);
        } else {
          await loadsApi.create({
            companyId: company.id,
            ...body,
            status: 'assigned',
            lat: 51.05 + Math.random() * 5,
            lng: -114 + Math.random() * 10,
            speed: 0,
            heading: 'E',
            lastUpdate: 'just now',
          });
        }
        await refreshAll?.();
      } else if (editLoad) {
        setLoads((p: any[]) =>
          p.map((l) => (l.id === editLoad.id ? { ...l, ...body } : l)),
        );
      } else {
        setLoads((p: any[]) => [
          ...p,
          {
            id: 'L' + uid().slice(0, 4).toUpperCase(),
            companyId: company.id,
            ...body,
            status: 'assigned',
            lat: 51.05 + Math.random() * 5,
            lng: -114 + Math.random() * 10,
            speed: 0,
            heading: 'E',
            lastUpdate: 'just now',
          },
        ]);
      }
      resetForm();
    } catch (e: any) {
      notify(e?.message || 'Failed to save load', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, s: string) => {
    try {
      if (apiEnabled) {
        await loadsApi.setStatus(id, s);
        await refreshAll?.();
      } else {
        setLoads((p: any[]) =>
          p.map((l) => (l.id === id ? { ...l, status: s } : l)),
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Status update failed', 'error');
    }
  };

  const deleteLoad = async (id: string) => {
    if (!window.confirm('Delete this load? This cannot be undone.')) return;
    try {
      if (apiEnabled) {
        await loadsApi.remove(id);
        await refreshAll?.();
      } else {
        setLoads((p: any[]) => p.filter((l) => l.id !== id));
      }
      notify('Load deleted.');
    } catch (e: any) {
      notify(e?.message || 'Delete failed', 'error');
    }
  };

  const stats = [
    {
      label: 'In Transit',
      value: loads.filter((l: any) => l.status === 'in_transit').length,
      accent: G.warning || G.gold,
      icon: Icons.play({ size: 20 }),
    },
    {
      label: 'Assigned',
      value: loads.filter((l: any) => l.status === 'assigned').length,
      accent: G.info,
      icon: Icons.schedule({ size: 20 }),
    },
    {
      label: 'Delivered',
      value: loads.filter((l: any) => l.status === 'delivered').length,
      accent: G.success,
      icon: Icons.checkCircle({ size: 20 }),
    },
    {
      label: 'Cancelled',
      value: loads.filter((l: any) => l.status === 'cancelled').length,
      accent: G.danger,
      icon: Icons.cancel({ size: 20 }),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: G.text }}>Dispatch</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
          Assign loads and manage trip status across your fleet.
        </div>
      </div>
      <StatsGrid items={stats} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>
            Load Board
          </div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 1 }}>
            {loads.length} total loads
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onEManifest && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={onEManifest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              {Icons.passport({ size: 16 })}
              eManifest
            </Btn>
          )}
          <Btn
            size="sm"
            onClick={() => {
              resetForm();
              setShow(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {Icons.add({ size: 16 })}
            Assign Load
          </Btn>
        </div>
      </div>

      {show && (
        <Card style={{ border: `1px solid ${G.gold}33` }}>
          <SectionTitle>{editLoad ? 'Edit Load' : 'Assign New Load'}</SectionTitle>
          <Err msg={docErr} />

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                letterSpacing: 2,
                color: G.muted,
                marginBottom: 8,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Driver *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {drivers.length === 0 && (
                <div style={{ fontSize: 11, color: G.muted, padding: 10 }}>
                  No drivers added yet.
                </div>
              )}
              {drivers.map((d: any) => {
                const missing = checkDriverDocs(d.id);
                const canDispatch = missing.length === 0;
                const onLoad = loads.find(
                  (l: any) =>
                    l.driverId === d.id &&
                    ['assigned', 'in_transit'].includes(l.status),
                );
                const selected = f.driverId === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (canDispatch && !onLoad) upd('driverId', d.id);
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selected
                        ? G.goldBg
                        : canDispatch
                          ? G.card2
                          : G.dangerBg,
                      border: `1px solid ${
                        selected
                          ? G.gold
                          : canDispatch
                            ? G.border2
                            : G.danger + '33'
                      }`,
                      borderRadius: 9,
                      padding: '10px 14px',
                      cursor: canDispatch && !onLoad ? 'pointer' : 'not-allowed',
                      opacity: onLoad ? 0.5 : 1,
                      transition: 'all .15s',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: canDispatch ? G.text : G.danger,
                        }}
                      >
                        {d.name}
                      </div>
                      {!canDispatch && (
                        <div
                          style={{ fontSize: 10, color: G.danger, marginTop: 2 }}
                        >
                          ⛔ Missing:{' '}
                          {missing
                            .map(
                              (id: string) =>
                                DRIVER_DOC_TYPES.find((x) => x.id === id)
                                  ?.label || id,
                            )
                            .join(', ')}
                        </div>
                      )}
                      {canDispatch && onLoad && (
                        <div
                          style={{ fontSize: 10, color: G.gold, marginTop: 2 }}
                        >
                          Already on active load {onLoad.id}
                        </div>
                      )}
                      {canDispatch && !onLoad && (
                        <div
                          style={{
                            fontSize: 10,
                            color: G.success,
                            marginTop: 2,
                          }}
                        >
                          ✓ Ready to dispatch
                        </div>
                      )}
                    </div>
                    {selected && (
                      <span style={{ color: G.gold, fontSize: 16 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <G2 cols={2}>
            <Inp
              label="Trip No."
              value={f.tripNo}
              onChange={(e: any) => upd('tripNo', e.target.value)}
              placeholder="e.g. 34320"
            />
            <div />
          </G2>
          <G2 cols={2}>
            <Sel
              label="Truck"
              value={f.truckId}
              onChange={(e: any) => upd('truckId', e.target.value)}
            >
              <option value="">— Select truck —</option>
              {trucks
                .filter((t: any) => t.status === 'active')
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    #{t.unitNo} · {t.year} {t.make} {t.model}
                  </option>
                ))}
            </Sel>
            <Sel
              label="Trailer"
              value={f.trailerId}
              onChange={(e: any) => upd('trailerId', e.target.value)}
            >
              <option value="">— Select trailer —</option>
              {trailers
                .filter((t: any) => t.status === 'active')
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    #{t.unitNo} · {t.make} {t.model}
                  </option>
                ))}
            </Sel>
          </G2>
          <G2 cols={2}>
            <Inp
              label="Origin *"
              value={f.origin}
              onChange={(e: any) => upd('origin', e.target.value)}
              placeholder="e.g. Calgary, AB"
            />
            <Inp
              label="Destination *"
              value={f.destination}
              onChange={(e: any) => upd('destination', e.target.value)}
              placeholder="e.g. Toronto, ON"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="Pickup Date / Time"
              value={f.pickupTime}
              onChange={(e: any) => upd('pickupTime', e.target.value)}
              placeholder="e.g. Jun 15 08:00"
            />
            <Inp
              label="ETA"
              value={f.eta}
              onChange={(e: any) => upd('eta', e.target.value)}
              placeholder="e.g. Jun 17 18:00"
            />
          </G2>
          <Inp
            label="Notes"
            value={f.notes}
            onChange={(e: any) => upd('notes', e.target.value)}
            placeholder="Any special instructions..."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={save} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving…' : editLoad ? 'Save Changes' : 'Assign Load'}
            </Btn>
            <Btn variant="outline" onClick={resetForm}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      {loads.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 60 }} hover={false}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: G.primaryBg,
              color: G.primary,
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
            }}
          >
            {Icons.truck({ size: 24 })}
          </div>
          <div style={{ color: G.muted, fontSize: 14 }}>
            No loads yet. Click{' '}
            <strong style={{ color: G.primary }}>Assign Load</strong> to get
            started.
          </div>
        </Card>
      ) : (
        loads.map((l: any) => {
          const driver = users.find((u: any) => u.id === l.driverId);
          const sc = statusColor[l.status] || G.muted;
          return (
            <Card key={l.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: G.gold,
                        letterSpacing: 1,
                      }}
                    >
                      {l.id}
                    </span>
                    {l.tripNo && (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.muted,
                          fontFamily: FONT_MONO,
                        }}
                      >
                        Trip #{l.tripNo}
                      </span>
                    )}
                    <Pill color={sc}>
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
                          boxShadow: `0 0 8px ${G.success}`,
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: G.text,
                      marginBottom: 4,
                    }}
                  >
                    {driver?.name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    🚛 {l.truckNo || '—'} &nbsp;·&nbsp; 📦 {l.trailerNo || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    📍 {l.origin} → {l.destination}
                  </div>
                  {l.pickupTime && (
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                      Pickup: {l.pickupTime}
                    </div>
                  )}
                  {l.eta && (
                    <div style={{ fontSize: 11, color: G.gold, marginTop: 2 }}>
                      ETA: {l.eta}
                    </div>
                  )}
                  {l.notes && (
                    <div
                      style={{
                        fontSize: 11,
                        color: G.muted,
                        marginTop: 4,
                        fontStyle: 'italic',
                      }}
                    >
                      {l.notes}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {l.status === 'assigned' && (
                      <Btn
                        size="sm"
                        onClick={() => setStatus(l.id, 'in_transit')}
                      >
                        ▶ Start
                      </Btn>
                    )}
                    {l.status === 'in_transit' && (
                      <Btn
                        variant="success"
                        size="sm"
                        onClick={() => setStatus(l.id, 'delivered')}
                      >
                        ✓ Deliver
                      </Btn>
                    )}
                    {!['delivered', 'cancelled'].includes(l.status) && (
                      <Btn
                        variant="danger"
                        size="sm"
                        onClick={() => setStatus(l.id, 'cancelled')}
                      >
                        ✕ Cancel
                      </Btn>
                    )}
                    <Btn variant="outline" size="sm" onClick={onTrack}>
                      📍 Track
                    </Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!['delivered'].includes(l.status) && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(l)}
                      >
                        ✏️ Edit
                      </Btn>
                    )}
                    <Btn
                      variant="danger"
                      size="sm"
                      onClick={() => deleteLoad(l.id)}
                    >
                      🗑
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
