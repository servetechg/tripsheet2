import { useEffect, useState } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, G2, StatCard, StatsGrid, Icons } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { assetsApi, companiesApi } from '@/lib/api';
import {
  ASSET_STATUSES,
  assetStatusLabel,
  canAssignAsset,
  normalizeAssetStatus,
} from '@/lib/assetStatus';

const emptyAsset = {
  type: 'truck',
  unitNo: '',
  year: '',
  make: '',
  model: '',
  vin: '',
  plate: '',
  notes: '',
  insuranceExpiry: '',
  insuranceProviderId: '',
  insuranceProviderName: '',
  plateExpiry: '',
  permitExpiry: '',
};

export function AssetsTab({
  company,
  assets,
  setAssets,
  loads,
  apiEnabled,
  refreshAll,
}: any) {
  const [assetTab, setAssetTab] = useState<'trucks' | 'trailers' | 'equipment'>(
    'trucks',
  );
  const [show, setShow] = useState(false);
  const [f, setF] = useState(emptyAsset);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [insurers, setInsurers] = useState<any[]>([]);

  useEffect(() => {
    if (!apiEnabled || !company?.id) return;
    void companiesApi
      .insuranceProviders(company.id, true)
      .then((list) => setInsurers(Array.isArray(list) ? list : []))
      .catch(() => setInsurers([]));
  }, [apiEnabled, company?.id]);

  const myTrucks = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'truck',
  );
  const myTrailers = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'trailer',
  );
  const myEquipment = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'equipment',
  );
  const list =
    assetTab === 'trucks'
      ? myTrucks
      : assetTab === 'trailers'
        ? myTrailers
        : myEquipment;
  const activeCount = list.filter((a: any) => canAssignAsset(a.status)).length;
  const typeLabel =
    assetTab === 'trucks'
      ? 'TRUCK'
      : assetTab === 'trailers'
        ? 'TRAILER'
        : 'EQUIPMENT';

  const add = async () => {
    if (blank(f.unitNo)) {
      setErr('Unit No. is required.');
      return;
    }
    if (
      assets.find(
        (a: any) =>
          a.companyId === company.id && a.unitNo === f.unitNo.trim(),
      )
    ) {
      setErr('Unit No. already exists.');
      return;
    }
    const type =
      assetTab === 'trucks'
        ? 'truck'
        : assetTab === 'trailers'
          ? 'trailer'
          : 'equipment';
    const body = {
      ...f,
      type,
      status: 'available' as const,
      unitNo: f.unitNo.trim(),
      companyId: company.id,
    };
    try {
      setBusy(true);
      if (apiEnabled) {
        await assetsApi.create(body);
        await refreshAll?.();
      } else {
        setAssets((p: any[]) => [...p, { ...body, id: uid() }]);
      }
      setF(emptyAsset);
      setShow(false);
      setErr('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save asset');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      if (apiEnabled) {
        await assetsApi.toggleActive(id);
        await refreshAll?.();
      } else {
        setAssets((p: any[]) =>
          p.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status:
                    normalizeAssetStatus(a.status) === 'available'
                      ? 'retired'
                      : 'available',
                }
              : a,
          ),
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Toggle failed', 'error');
    }
  };

  const setAssetStatus = async (id: string, status: string) => {
    try {
      if (apiEnabled) {
        await assetsApi.setStatus(id, status);
        await refreshAll?.();
      } else {
        setAssets((p: any[]) =>
          p.map((a) => (a.id === id ? { ...a, status } : a)),
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Status update failed', 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      if (apiEnabled) {
        await assetsApi.remove(id);
        await refreshAll?.();
      } else {
        setAssets((p: any[]) => p.filter((a) => a.id !== id));
      }
    } catch (e: any) {
      notify(e?.message || 'Remove failed', 'error');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = (dt?: string) => !!dt && dt <= today;

  return (
    <div>
      <StatsGrid>
        <StatCard
          label="Trucks"
          value={myTrucks.length}
          subtitle="Power units"
          accent={G.info}
          icon={Icons.truck({ size: 20, color: G.info })}
        />
        <StatCard
          label="Trailers"
          value={myTrailers.length}
          subtitle="Trailers"
          accent={G.purple}
          icon={Icons.assets({ size: 20, color: G.purple })}
        />
        <StatCard
          label="Equipment"
          value={myEquipment.length}
          subtitle="General"
          accent={G.gold}
          icon={Icons.status({ size: 20, color: G.gold })}
        />
        <StatCard
          label="Active"
          value={activeCount}
          subtitle={`Current ${assetTab}`}
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
        />
      </StatsGrid>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(
          [
            ['trucks', 'TRUCKS', Icons.truck],
            ['trailers', 'TRAILERS', Icons.trailer],
            ['equipment', 'EQUIPMENT', Icons.status],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              setAssetTab(id);
              setShow(false);
            }}
            style={{
              background: assetTab === id ? G.gold : 'transparent',
              color: assetTab === id ? G.onGold : G.muted,
              border: `1px solid ${assetTab === id ? G.gold : G.border}`,
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icon({
              size: 16,
              color: assetTab === id ? G.onGold : G.muted,
            })}
            {label}
          </button>
        ))}
        <Btn
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setShow(true);
            setErr('');
          }}
        >
          + ADD {typeLabel}
        </Btn>
      </div>

      {show && (
        <Card>
          <SectionTitle>ADD {typeLabel}</SectionTitle>
          <Err msg={err} />
          <G2 cols={2}>
            <Inp
              label="Unit No. *"
              value={f.unitNo}
              type="text"
              onChange={(e: any) =>
                setF((x) => ({ ...x, unitNo: e.target.value }))
              }
              placeholder="e.g. 32054"
            />
            <Inp
              label="Year"
              value={f.year}
              type="number"
              onChange={(e: any) =>
                setF((x) => ({ ...x, year: e.target.value }))
              }
              placeholder="e.g. 2022"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="Make"
              value={f.make}
              type="text"
              onChange={(e: any) =>
                setF((x) => ({ ...x, make: e.target.value }))
              }
            />
            <Inp
              label="Model"
              value={f.model}
              type="text"
              onChange={(e: any) =>
                setF((x) => ({ ...x, model: e.target.value }))
              }
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="VIN"
              value={f.vin}
              type="text"
              onChange={(e: any) =>
                setF((x) => ({ ...x, vin: e.target.value }))
              }
              placeholder="17-character vehicle ID number"
            />
            <Inp
              label="Plate No."
              value={f.plate}
              type="text"
              onChange={(e: any) =>
                setF((x) => ({ ...x, plate: e.target.value }))
              }
            />
          </G2>
          <G2 cols={2}>
            <Sel
              label="Insurance provider"
              value={f.insuranceProviderId}
              onChange={(e: any) => {
                const id = e.target.value;
                const p = insurers.find((x: any) => x.id === id);
                setF((x) => ({
                  ...x,
                  insuranceProviderId: id,
                  insuranceProviderName: p?.name || '',
                }));
              }}
            >
              <option value="">— Optional —</option>
              {insurers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Sel>
            <Inp
              label="Insurance expiry"
              value={f.insuranceExpiry}
              onChange={(e: any) =>
                setF((x) => ({ ...x, insuranceExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="Plate expiry"
              value={f.plateExpiry}
              onChange={(e: any) =>
                setF((x) => ({ ...x, plateExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
            <Inp
              label="Permit expiry"
              value={f.permitExpiry}
              onChange={(e: any) =>
                setF((x) => ({ ...x, permitExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
          </G2>
          <Inp
            label="Notes"
            value={f.notes}
            type="text"
            onChange={(e: any) =>
              setF((x) => ({ ...x, notes: e.target.value }))
            }
            placeholder="Optional notes about this asset"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={add} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'SAVING…' : 'SAVE ASSET'}
            </Btn>
            <Btn
              variant="outline"
              onClick={() => {
                setShow(false);
                setErr('');
              }}
            >
              CANCEL
            </Btn>
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div>
            {(assetTab === 'trucks'
              ? Icons.truck
              : assetTab === 'trailers'
                ? Icons.trailer
                : Icons.status)({
              size: 36,
              color: G.muted,
            })}
          </div>
          <div style={{ color: G.muted, marginTop: 10 }}>
            No {assetTab} added yet.
          </div>
        </Card>
      ) : (
        list.map((a: any) => (
          <Card key={a.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: G.gold,
                      fontFamily: FONT_MONO,
                    }}
                  >
                    #{a.unitNo}
                  </span>
                  <Pill
                    color={
                      canAssignAsset(a.status)
                        ? G.success
                        : normalizeAssetStatus(a.status) === 'out_of_service'
                          ? G.danger
                          : G.muted
                    }
                  >
                    {assetStatusLabel(a.status)}
                  </Pill>
                  {loads.find(
                    (l: any) =>
                      ['assigned', 'in_transit'].includes(l.status) &&
                      (l.truckId === a.id || l.trailerId === a.id),
                  ) && <Pill color={G.gold}>IN USE</Pill>}
                  {(isExpired(a.insuranceExpiry) ||
                    isExpired(a.plateExpiry) ||
                    isExpired(a.permitExpiry)) && (
                    <Pill color={G.danger}>EXPIRED</Pill>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {a.year} {a.make} {a.model}
                </div>
                {a.plate && (
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    Plate:{' '}
                    <span style={{ fontFamily: FONT_MONO }}>{a.plate}</span>
                  </div>
                )}
                {(a.insuranceExpiry || a.plateExpiry || a.permitExpiry) && (
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
                    Ins {a.insuranceExpiry || '—'}
                    {a.insuranceProviderName
                      ? ` (${a.insuranceProviderName})`
                      : ''}{' '}
                    · Plate {a.plateExpiry || '—'}{' '}
                    · Permit {a.permitExpiry || '—'}
                  </div>
                )}
                {a.notes && (
                  <div
                    style={{
                      fontSize: 11,
                      color: G.muted,
                      marginTop: 4,
                      fontStyle: 'italic',
                    }}
                  >
                    {a.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={normalizeAssetStatus(a.status)}
                  onChange={(e) => void setAssetStatus(a.id, e.target.value)}
                  style={{
                    background: '#0a0a0e',
                    border: `1px solid ${G.border}`,
                    color: G.text,
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 11,
                  }}
                >
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => toggleStatus(a.id)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${
                      canAssignAsset(a.status) ? G.muted : G.success
                    }`,
                    color: canAssignAsset(a.status) ? G.muted : G.success,
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {canAssignAsset(a.status) ? 'RETIRE' : 'MAKE AVAILABLE'}
                </button>
                <button
                  onClick={() => remove(a.id)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${G.danger}`,
                    color: G.danger,
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {Icons.trash({ size: 16, color: G.danger })}
                  REMOVE
                </button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
