import { useState } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import {
  Btn,
  Card,
  FieldInp,
  Sel,
  Pill,
  SectionTitle,
  G2,
  StatCard,
  StatsGrid,
  Icons,
  SearchSelect,
} from '@/components/ui';
import { blank } from '@/lib/format';
import {
  datetimeLocalToIso,
  formatDisplayDateTime,
  isValidTripNo,
  parseNonNegNumber,
  sanitizeDecimal,
  sanitizeInteger,
  toDatetimeLocal,
} from '@/lib/formFields';
import { FREIGHT_LOCATIONS } from '@/lib/locations';
import { uid } from '@/lib/uid';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { loadsApi, driversApi, notificationsApi } from '@/lib/api';
import { matchesDriverRef } from '@/lib/driverIds';

type FormErrors = Partial<
  Record<
    | 'driverId'
    | 'truckId'
    | 'origin'
    | 'destination'
    | 'pickupTime'
    | 'eta'
    | 'tripNo'
    | 'customerRate'
    | 'carrierCost'
    | 'fuelSurcharge'
    | 'accessorials'
    | 'detentionHours'
    | 'detentionRate'
    | 'miles'
    | 'stop1'
    | 'stop2'
    | 'notes',
    string
  >
>;

const LOCATION_OPTIONS = [...FREIGHT_LOCATIONS];

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
  const [fieldErr, setFieldErr] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const emptyForm = {
    driverId: '',
    truckId: '',
    trailerId: '',
    origin: '',
    destination: '',
    pickupTime: '',
    eta: '',
    tripNo: '',
    notes: '',
    customerRate: '',
    carrierCost: '',
    fuelSurcharge: '',
    accessorials: '',
    detentionHours: '',
    detentionRate: '',
    miles: '',
    stop1: '',
    stop2: '',
  };
  const [f, setF] = useState(emptyForm);
  const upd = (k: string, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setFieldErr((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k as keyof FormErrors];
      return next;
    });
  };
  const resetForm = () => {
    setF(emptyForm);
    setEditLoad(null);
    setShow(false);
    setDocErr('');
    setFieldErr({});
  };
  const openEdit = (l: any) => {
    const stops = Array.isArray(l.stops) ? l.stops : [];
    setF({
      driverId: l.driverId || '',
      truckId: l.truckId || '',
      trailerId: l.trailerId || '',
      origin: l.origin || '',
      destination: l.destination || '',
      pickupTime: toDatetimeLocal(l.pickupTime || ''),
      eta: toDatetimeLocal(l.eta || ''),
      tripNo: l.tripNo || '',
      notes: l.notes || '',
      customerRate: l.customerRate != null ? String(l.customerRate) : '',
      carrierCost: l.carrierCost != null ? String(l.carrierCost) : '',
      fuelSurcharge: l.fuelSurcharge != null ? String(l.fuelSurcharge) : '',
      accessorials: l.accessorials != null ? String(l.accessorials) : '',
      detentionHours: l.detentionHours != null ? String(l.detentionHours) : '',
      detentionRate: l.detentionRate != null ? String(l.detentionRate) : '',
      miles: l.miles != null ? String(l.miles) : '',
      stop1: stops[0]?.location || stops[0] || '',
      stop2: stops[1]?.location || stops[1] || '',
    });
    setFieldErr({});
    setEditLoad(l);
    setShow(true);
  };

  const DISPATCH_REQUIRED = ['license', 'abstract', 'medical'];
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

  const checkDriverDocs = (driverId: string) => {
    const driver =
      drivers.find((d: any) => d.id === driverId) ||
      users.find((u: any) => u.id === driverId);
    const dd = (driverDocs || []).filter(
      (d: any) =>
        (driver
          ? matchesDriverRef(d.driverId, driver)
          : d.driverId === driverId) && d.status !== 'expired',
    );
    return DISPATCH_REQUIRED.filter(
      (id) => !dd.find((d: any) => d.type === id),
    );
  };

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const validateForm = (): FormErrors => {
    const errs: FormErrors = {};
    if (blank(f.driverId)) errs.driverId = 'Select a driver';
    if (blank(f.truckId)) errs.truckId = 'Select a truck';
    if (blank(f.origin)) errs.origin = 'Origin is required';
    if (blank(f.destination)) errs.destination = 'Destination is required';
    if (
      !blank(f.origin) &&
      !blank(f.destination) &&
      f.origin.trim().toLowerCase() === f.destination.trim().toLowerCase()
    ) {
      errs.destination = 'Destination must differ from origin';
    }
    if (blank(f.pickupTime)) errs.pickupTime = 'Pickup date & time is required';

    const pickupMs = f.pickupTime ? new Date(f.pickupTime).getTime() : NaN;
    const etaMs = f.eta ? new Date(f.eta).getTime() : NaN;
    if (f.pickupTime && Number.isNaN(pickupMs)) {
      errs.pickupTime = 'Invalid pickup date/time';
    }
    if (f.eta && Number.isNaN(etaMs)) {
      errs.eta = 'Invalid ETA';
    }
    if (
      Number.isFinite(pickupMs) &&
      Number.isFinite(etaMs) &&
      etaMs < pickupMs
    ) {
      errs.eta = 'ETA must be on or after pickup';
    }

    if (!isValidTripNo(f.tripNo)) {
      errs.tripNo = 'Use letters, numbers, - _ / (max 32)';
    }

    const moneyFields: (keyof FormErrors)[] = [
      'customerRate',
      'carrierCost',
      'fuelSurcharge',
      'accessorials',
      'detentionRate',
    ];
    for (const key of moneyFields) {
      const raw = String(f[key as keyof typeof f] ?? '');
      if (parseNonNegNumber(raw) === null) {
        errs[key] = 'Enter a valid amount ≥ 0';
      }
    }
    if (parseNonNegNumber(f.detentionHours) === null) {
      errs.detentionHours = 'Enter hours ≥ 0';
    }
    if (parseNonNegNumber(f.miles) === null) {
      errs.miles = 'Enter miles ≥ 0';
    }
    if (f.notes.length > 500) {
      errs.notes = 'Notes max 500 characters';
    }
    if (
      !blank(f.stop1) &&
      f.stop1.trim().toLowerCase() === f.origin.trim().toLowerCase()
    ) {
      errs.stop1 = 'Stop should differ from origin';
    }
    if (
      !blank(f.stop2) &&
      !blank(f.stop1) &&
      f.stop2.trim().toLowerCase() === f.stop1.trim().toLowerCase()
    ) {
      errs.stop2 = 'Stops must be different';
    }
    return errs;
  };

  const payloadFromForm = () => {
    const truck = trucks.find((t: any) => t.id === f.truckId);
    const trailer = trailers.find((t: any) => t.id === f.trailerId);
    const stops = [f.stop1, f.stop2]
      .filter((s) => !blank(s))
      .map((location, i) => ({ seq: i + 1, location }));
    return {
      driverId: f.driverId,
      truckId: f.truckId,
      trailerId: f.trailerId,
      origin: f.origin.trim(),
      destination: f.destination.trim(),
      pickupTime: datetimeLocalToIso(f.pickupTime),
      eta: datetimeLocalToIso(f.eta),
      tripNo: f.tripNo.trim(),
      notes: f.notes.trim(),
      truckNo: truck?.unitNo || '',
      trailerNo: trailer?.unitNo || '',
      customerRate: num(f.customerRate),
      carrierCost: num(f.carrierCost),
      fuelSurcharge: num(f.fuelSurcharge),
      accessorials: num(f.accessorials),
      detentionHours: num(f.detentionHours),
      detentionRate: num(f.detentionRate),
      miles: num(f.miles),
      stops,
    };
  };

  const loadMargin = (l: any) => {
    const rev =
      Number(l.customerRate || 0) +
      Number(l.fuelSurcharge || 0) +
      Number(l.accessorials || 0) +
      Number(l.detentionHours || 0) * Number(l.detentionRate || 0);
    const cost = Number(l.carrierCost || 0);
    return { rev, cost, margin: rev - cost };
  };

  const save = async () => {
    const errs = validateForm();
    setFieldErr(errs);
    if (Object.keys(errs).length > 0) {
      setDocErr('Fix the highlighted fields before saving.');
      return;
    }
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
          const driver =
            drivers.find((d: any) => d.id === body.driverId) ||
            users.find((u: any) => u.id === body.driverId);
          if (driver?.phone) {
            try {
              await notificationsApi.sendSms({
                to: String(driver.phone),
                body: `${company.shortName || 'TripSheet'}: new load ${body.origin} → ${body.destination}`,
                companyId: company.id,
                meta: { type: 'load_assigned', driverId: body.driverId },
              });
            } catch {
              /* SMS optional — do not block dispatch */
            }
          }
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
        if (s === 'delivered') {
          try {
            await loadsApi.update(id, {
              actualDelivery: new Date().toISOString(),
            });
          } catch {
            /* optional */
          }
        }
        await refreshAll?.();
      } else {
        setLoads((p: any[]) =>
          p.map((l) =>
            l.id === id
              ? {
                  ...l,
                  status: s,
                  ...(s === 'delivered'
                    ? { actualDelivery: new Date().toISOString() }
                    : {}),
                }
              : l,
          ),
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
      color: G.warning,
      subtitle: 'Currently moving',
      icon: Icons.running({ size: 20, color: G.warning }),
    },
    {
      label: 'Assigned',
      value: loads.filter((l: any) => l.status === 'assigned').length,
      color: G.info,
      subtitle: 'Ready to start',
      icon: Icons.assigned({ size: 20, color: G.info }),
    },
    {
      label: 'Delivered',
      value: loads.filter((l: any) => l.status === 'delivered').length,
      color: G.success,
      subtitle: 'Completed loads',
      icon: Icons.completed({ size: 20, color: G.success }),
    },
    {
      label: 'Cancelled',
      value: loads.filter((l: any) => l.status === 'cancelled').length,
      color: G.danger,
      subtitle: 'Stopped loads',
      icon: Icons.cancelled({ size: 20, color: G.danger }),
    },
  ];

  return (
    <div>
      <StatsGrid>
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            subtitle={s.subtitle}
            accent={s.color}
            icon={s.icon}
          />
        ))}
      </StatsGrid>

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
              }}
            >
              {Icons.emanifest({ size: 16, color: G.muted })}
              eManifest
            </Btn>
          )}
          <Btn
            size="sm"
            onClick={() => {
              resetForm();
              setShow(true);
            }}
          >
            + Assign Load
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
            {fieldErr.driverId && (
              <div style={{ fontSize: 11, color: G.danger, marginBottom: 8 }}>
                {fieldErr.driverId}
              </div>
            )}
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
                          ? '#0a0a0e'
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
                          style={{
                            fontSize: 10,
                            color: G.danger,
                            marginTop: 2,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {Icons.alert({ size: 12, color: G.danger })}
                          Missing:{' '}
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
            <FieldInp
              label="Trip No."
              value={f.tripNo}
              onChange={(e: any) =>
                upd(
                  'tripNo',
                  e.target.value.replace(/[^A-Za-z0-9\-_\/]/g, '').slice(0, 32),
                )
              }
              placeholder="e.g. 34320"
              maxLength={32}
              error={fieldErr.tripNo}
              hint="Letters, numbers, - _ /"
            />
            <div />
          </G2>
          <G2 cols={2}>
            <div>
              <Sel
                label="Truck *"
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
              {fieldErr.truckId && (
                <div
                  style={{
                    fontSize: 11,
                    color: G.danger,
                    marginTop: -8,
                    marginBottom: 12,
                  }}
                >
                  {fieldErr.truckId}
                </div>
              )}
            </div>
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
            <SearchSelect
              label="Origin"
              required
              value={f.origin}
              onChange={(v) => upd('origin', v)}
              options={LOCATION_OPTIONS}
              placeholder="Search city… e.g. Calgary"
              allowCustom
              error={fieldErr.origin}
            />
            <SearchSelect
              label="Destination"
              required
              value={f.destination}
              onChange={(v) => upd('destination', v)}
              options={LOCATION_OPTIONS}
              placeholder="Search city… e.g. Toronto"
              allowCustom
              error={fieldErr.destination}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Pickup date & time *"
              type="datetime-local"
              value={f.pickupTime}
              onChange={(e: any) => upd('pickupTime', e.target.value)}
              error={fieldErr.pickupTime}
              inputStyle={{ colorScheme: G.mode === 'light' ? 'light' : 'dark' }}
            />
            <FieldInp
              label="ETA"
              type="datetime-local"
              value={f.eta}
              min={f.pickupTime || undefined}
              onChange={(e: any) => upd('eta', e.target.value)}
              error={fieldErr.eta}
              hint="Must be on or after pickup"
              inputStyle={{ colorScheme: G.mode === 'light' ? 'light' : 'dark' }}
            />
          </G2>
          <SectionTitle>Economics & stops</SectionTitle>
          <G2 cols={2}>
            <FieldInp
              label="Customer rate ($)"
              inputMode="decimal"
              value={f.customerRate}
              onChange={(e: any) =>
                upd('customerRate', sanitizeDecimal(e.target.value, 2))
              }
              placeholder="0.00"
              error={fieldErr.customerRate}
            />
            <FieldInp
              label="Carrier cost ($)"
              inputMode="decimal"
              value={f.carrierCost}
              onChange={(e: any) =>
                upd('carrierCost', sanitizeDecimal(e.target.value, 2))
              }
              placeholder="0.00"
              error={fieldErr.carrierCost}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Fuel surcharge ($)"
              inputMode="decimal"
              value={f.fuelSurcharge}
              onChange={(e: any) =>
                upd('fuelSurcharge', sanitizeDecimal(e.target.value, 2))
              }
              placeholder="0.00"
              error={fieldErr.fuelSurcharge}
            />
            <FieldInp
              label="Accessorials ($)"
              inputMode="decimal"
              value={f.accessorials}
              onChange={(e: any) =>
                upd('accessorials', sanitizeDecimal(e.target.value, 2))
              }
              placeholder="0.00"
              error={fieldErr.accessorials}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Detention hours"
              inputMode="decimal"
              value={f.detentionHours}
              onChange={(e: any) =>
                upd('detentionHours', sanitizeDecimal(e.target.value, 1))
              }
              placeholder="0"
              error={fieldErr.detentionHours}
            />
            <FieldInp
              label="Detention rate ($/hr)"
              inputMode="decimal"
              value={f.detentionRate}
              onChange={(e: any) =>
                upd('detentionRate', sanitizeDecimal(e.target.value, 2))
              }
              placeholder="0.00"
              error={fieldErr.detentionRate}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Miles"
              inputMode="numeric"
              value={f.miles}
              onChange={(e: any) =>
                upd('miles', sanitizeInteger(e.target.value).slice(0, 6))
              }
              placeholder="e.g. 1200"
              error={fieldErr.miles}
            />
            <SearchSelect
              label="Stop 1 (optional)"
              value={f.stop1}
              onChange={(v) => upd('stop1', v)}
              options={LOCATION_OPTIONS}
              placeholder="Search intermediate stop…"
              allowCustom
              error={fieldErr.stop1}
            />
          </G2>
          <SearchSelect
            label="Stop 2 (optional)"
            value={f.stop2}
            onChange={(v) => upd('stop2', v)}
            options={LOCATION_OPTIONS}
            placeholder="Search intermediate stop…"
            allowCustom
            error={fieldErr.stop2}
          />
          <FieldInp
            label="Notes"
            value={f.notes}
            onChange={(e: any) => upd('notes', e.target.value.slice(0, 500))}
            placeholder="Any special instructions…"
            maxLength={500}
            error={fieldErr.notes}
            hint={`${f.notes.length}/500`}
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
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ marginBottom: 12 }}>
            {Icons.dispatch({ size: 36, color: G.muted })}
          </div>
          <div style={{ color: G.muted }}>
            No loads yet. Click{' '}
            <strong style={{ color: G.gold }}>+ Assign Load</strong> to get
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
                  <div
                    style={{
                      fontSize: 11,
                      color: G.muted,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    {Icons.truck({ size: 14, color: G.muted })}
                    {l.truckNo || '—'}
                    <span>·</span>
                    {Icons.trailer({ size: 14, color: G.muted })}
                    {l.trailerNo || '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: G.muted,
                      marginTop: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.pin({ size: 14, color: G.muted })}
                    {l.origin} → {l.destination}
                  </div>
                  {l.pickupTime && (
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                      Pickup: {formatDisplayDateTime(l.pickupTime)}
                    </div>
                  )}
                  {l.eta && (
                    <div style={{ fontSize: 11, color: G.gold, marginTop: 2 }}>
                      ETA: {formatDisplayDateTime(l.eta)}
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
                  {(() => {
                    const { rev, cost, margin } = loadMargin(l);
                    if (rev === 0 && cost === 0) return null;
                    const stops = Array.isArray(l.stops) ? l.stops : [];
                    return (
                      <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>
                        Rev ${rev.toFixed(0)} · Cost ${cost.toFixed(0)} · Margin{' '}
                        <span
                          style={{
                            color: margin >= 0 ? G.success : G.danger,
                            fontWeight: 700,
                          }}
                        >
                          ${margin.toFixed(0)}
                        </span>
                        {l.miles ? ` · ${l.miles} mi` : ''}
                        {stops.length > 0 &&
                          ` · stops: ${stops
                            .map((s: any) => s.location || s)
                            .join(' → ')}`}
                      </div>
                    );
                  })()}
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
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={onTrack}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {Icons.track({ size: 16, color: G.muted })}
                      Track
                    </Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!['delivered'].includes(l.status) && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(l)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {Icons.edit({ size: 16, color: G.muted })}
                        Edit
                      </Btn>
                    )}
                    <Btn
                      variant="danger"
                      size="sm"
                      onClick={() => deleteLoad(l.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {Icons.trash({ size: 16, color: G.danger })}
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
