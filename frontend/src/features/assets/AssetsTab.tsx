import { useEffect, useMemo, useState } from 'react';
import type { SearchSelectOption } from '@/components/ui';
import { G, FONT_MONO } from '@/lib/theme';
import {
  Btn,
  Card,
  Inp,
  Sel,
  SectionTitle,
  Pill,
  G2,
  StatCard,
  StatsGrid,
  Icons,
  SearchSelect,
} from '@/components/ui';
import { useVpicCatalog } from '@/features/assets/useVpicCatalog';
import type { VpicAssetType } from '@/features/assets/types';
import { normalizeVinInput } from '@/features/assets/vinHelpers';
import {
  VinSearchSelect,
  type VinApplyPayload,
} from '@/features/assets/VinSearchSelect';
import { blank, humanizeEnum, isCompactIdentifier, getApiErrorMessage } from '@/lib/format';
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
import type { Asset } from '@tripsheet/shared';
import type { AssetsTabProps } from '@/types/tabs';

type FleetAsset = Asset & {
  insuranceProviderId?: string;
  insuranceProviderName?: string;
};

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
}: AssetsTabProps) {
  const [assetTab, setAssetTab] = useState<'trucks' | 'trailers' | 'equipment'>(
    'trucks',
  );
  const [show, setShow] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [f, setF] = useState(emptyAsset);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [insurers, setInsurers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [vpicNote, setVpicNote] = useState('');

  const vpicVehicleType: VpicAssetType =
    assetTab === 'trailers'
      ? 'trailer'
      : assetTab === 'equipment'
        ? 'equipment'
        : 'truck';

  const vpic = useVpicCatalog(Boolean(apiEnabled && show), vpicVehicleType, f.year, f.make);

  useEffect(() => {
    if (!apiEnabled || !company?.id) return;
    void companiesApi
      .insuranceProviders(company.id, true)
      .then((list) => setInsurers(Array.isArray(list) ? list : []))
      .catch(() => setInsurers([]));
  }, [apiEnabled, company?.id]);

  const myTrucks = assets.filter(
    (a) => a.companyId === company.id && a.type === 'truck',
  );
  const myTrailers = assets.filter(
    (a) => a.companyId === company.id && a.type === 'trailer',
  );
  const myEquipment = assets.filter(
    (a) => a.companyId === company.id && a.type === 'equipment',
  );
  const list =
    assetTab === 'trucks'
      ? myTrucks
      : assetTab === 'trailers'
        ? myTrailers
        : myEquipment;
  const activeCount = list.filter((a) => canAssignAsset(a.status)).length;
  const typeLabel =
    assetTab === 'trucks'
      ? 'TRUCK'
      : assetTab === 'trailers'
        ? 'TRAILER'
        : 'EQUIPMENT';

  const assetTypeForTab =
    assetTab === 'trucks'
      ? 'truck'
      : assetTab === 'trailers'
        ? 'trailer'
        : 'equipment';

  const fleetVinOptions = useMemo((): SearchSelectOption[] => {
    const seen = new Set<string>();
    const rows: SearchSelectOption[] = [];
    for (const a of assets) {
      if (a.companyId !== company.id || a.type !== assetTypeForTab) continue;
      if (editAsset && a.id === editAsset.id) continue;
      const vin = normalizeVinInput(a.vin || '');
      if (!vin || seen.has(vin)) continue;
      seen.add(vin);
      const desc = [a.year, a.make, a.model].filter(Boolean).join(' ');
      rows.push({
        value: vin,
        label: desc
          ? `${vin} · Unit ${a.unitNo} · ${desc}`
          : `${vin} · Unit ${a.unitNo}`,
      });
    }
    return rows.sort((x, y) => x.value.localeCompare(y.value));
  }, [assets, company.id, assetTypeForTab, editAsset]);

  const onVinApply = (payload: VinApplyPayload) => {
    const normalized = normalizeVinInput(payload.vin);
    if (!normalized) {
      setF((x) => ({ ...x, vin: '' }));
      setVpicNote('');
      return;
    }
    const fleetMatch = assets.find(
      (a) =>
        a.companyId === company.id &&
        a.type === assetTypeForTab &&
        normalizeVinInput(a.vin || '') === normalized &&
        (!editAsset || a.id !== editAsset.id),
    );
    if (fleetMatch) {
      setF((x) => ({
        ...x,
        vin: normalized,
        year: fleetMatch.year != null ? String(fleetMatch.year) : x.year,
        make: fleetMatch.make || x.make,
        model: fleetMatch.model || x.model,
      }));
      setVpicNote(payload.note);
      return;
    }
    setF((x) => ({
      ...x,
      vin: normalized,
      year: payload.year || x.year,
      make: payload.make || x.make,
      model: payload.model || x.model,
    }));
    setVpicNote(payload.note);
  };

  const openEdit = (a: FleetAsset) => {
    setEditAsset(a);
    setF({
      type: a.type || 'truck',
      unitNo: a.unitNo || '',
      year: a.year != null ? String(a.year) : '',
      make: a.make || '',
      model: a.model || '',
      vin: a.vin || '',
      plate: a.plate || '',
      notes: a.notes || '',
      insuranceExpiry: a.insuranceExpiry || '',
      insuranceProviderId: a.insuranceProviderId || '',
      insuranceProviderName: a.insuranceProviderName || '',
      plateExpiry: a.plateExpiry || '',
      permitExpiry: a.permitExpiry || '',
    });
    setShow(true);
    setErr('');
    setVpicNote('');
  };

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (k: string) => {
    setTouched((prev) => ({ ...prev, [k]: true }));
  };

  const validateAssetForm = () => {
    return {} as Record<string, string>;
  };

  const assetFieldErrors = validateAssetForm();
  const isAssetFormValid = Object.keys(assetFieldErrors).length === 0;

  const resetAssetForm = () => {
    setF(emptyAsset);
    setEditAsset(null);
    setShow(false);
    setTouched({});
    setErr('');
    setVpicNote('');
  };

  const saveAsset = async () => {
    const errs = validateAssetForm();
    if (Object.keys(errs).length > 0) {
      setErr(Object.values(errs)[0]);
      return;
    }
    const type =
      assetTab === 'trucks'
        ? 'truck'
        : assetTab === 'trailers'
          ? 'trailer'
          : 'equipment';
    const body: Partial<Asset> & {
      type: string;
      companyId: string;
    } = {
      ...f,
      type,
      companyId: company.id,
    };
    if (editAsset) {
      delete (body as { unitNo?: string }).unitNo;
    }
    if (!editAsset) {
      body.status = 'available';
    }
    try {
      setBusy(true);
      if (apiEnabled) {
        if (editAsset) {
          await assetsApi.update(editAsset.id, body);
        } else {
          await assetsApi.create(body);
        }
        await refreshAll?.();
      } else if (editAsset) {
        setAssets((p) =>
          p.map((a) => (a.id === editAsset.id ? { ...a, ...body } : a)),
        );
      } else {
        setAssets((p) => [
          ...p,
          { ...body, id: uid(), status: 'available' } as FleetAsset,
        ]);
      }
      resetAssetForm();
    } catch (e: unknown) {
      setErr(getApiErrorMessage(e, 'Failed to save asset'));
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
        setAssets((p) =>
          p.map((a) =>
            a.id === id
              ? ({
                  ...a,
                  status:
                    normalizeAssetStatus(a.status) === 'available'
                      ? 'retired'
                      : 'available',
                } as FleetAsset)
              : a,
          ),
        );
      }
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Toggle failed'), 'error');
    }
  };

  const setAssetStatus = async (id: string, status: string) => {
    try {
      if (apiEnabled) {
        await assetsApi.setStatus(id, status);
        await refreshAll?.();
      } else {
        setAssets((p) =>
          p.map((a) =>
            a.id === id ? ({ ...a, status } as FleetAsset) : a,
          ),
        );
      }
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Status update failed'), 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      if (apiEnabled) {
        await assetsApi.remove(id);
        await refreshAll?.();
      } else {
        setAssets((p) => p.filter((a) => a.id !== id));
      }
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Remove failed'), 'error');
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
              resetAssetForm();
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
            setEditAsset(null);
            setF(emptyAsset);
            setShow(true);
            setErr('');
            setVpicNote('');
          }}
        >
          + ADD {typeLabel}
        </Btn>
      </div>

      {show && (
        <Card>
          <SectionTitle>{editAsset ? `EDIT ${typeLabel}` : `ADD ${typeLabel}`}</SectionTitle>
          <Err msg={err} />
          <div
            style={{
              fontSize: 11,
              color: G.muted,
              marginBottom: 12,
              lineHeight: 1.45,
            }}
          >
            Start with the VIN — matching fleet VINs appear as you type. When you
            enter a full 17-character VIN, NHTSA vPIC (US &amp; Canada) shows in
            the list; pick it or press Enter to fill year, make, and model.
          </div>
          <VinSearchSelect
            label="VIN (17 characters)"
            value={f.vin}
            fleetOptions={fleetVinOptions}
            apiEnabled={Boolean(apiEnabled)}
            onApply={onVinApply}
            placeholder={
              fleetVinOptions.length
                ? 'Type or search VIN…'
                : 'Type 17-character VIN…'
            }
          />
          <G2 cols={2}>
            {editAsset ? (
              <Inp
                label="Unit No."
                value={f.unitNo || editAsset.unitNo || ''}
                readOnly
                disabled
              />
            ) : null}
            <Inp
              label="Plate No."
              value={f.plate}
              onChange={(e) =>
                setF((x) => ({ ...x, plate: e.target.value }))
              }
            />
          </G2>
          <G2 cols={2}>
            <SearchSelect
              label="Year"
              value={f.year}
              onChange={(year) =>
                setF((x) => ({ ...x, year, model: '' }))
              }
              options={vpic.years}
              placeholder={
                apiEnabled ? 'Search year…' : 'API offline — type year'
              }
              disabled={!apiEnabled && vpic.years.length === 0}
              allowCustom
            />
            <SearchSelect
              label="Make"
              value={f.make}
              onChange={(make) =>
                setF((x) => ({ ...x, make, model: '' }))
              }
              options={vpic.makes}
              placeholder={
                vpic.loadingMakes
                  ? 'Loading makes…'
                  : apiEnabled
                    ? 'Search make…'
                    : 'Type make'
              }
              disabled={!apiEnabled && vpic.makes.length === 0}
              allowCustom
            />
          </G2>
          <G2 cols={2}>
            <SearchSelect
              label="Model"
              value={f.model}
              onChange={(model) => setF((x) => ({ ...x, model }))}
              options={vpic.models}
              placeholder={
                !f.year || !f.make
                  ? 'Select year and make first'
                  : vpic.loadingModels
                    ? 'Loading models…'
                    : 'Search model…'
              }
              disabled={
                (!f.year || !f.make) &&
                vpic.models.length === 0 &&
                !f.model
              }
              allowCustom
            />
            <div />
          </G2>
          {vpicNote ? (
            <div
              style={{
                fontSize: 11,
                color: G.muted,
                marginBottom: 12,
                lineHeight: 1.45,
              }}
            >
              {vpicNote}
            </div>
          ) : null}
          <G2 cols={2}>
            <Sel
              label="Insurance provider"
              value={f.insuranceProviderId}
              onChange={(e) => {
                const id = e.target.value;
                const p = insurers.find((x) => x.id === id);
                setF((x) => ({
                  ...x,
                  insuranceProviderId: id,
                  insuranceProviderName: p?.name || '',
                }));
              }}
            >
              <option value="">— Optional —</option>
              {insurers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Sel>
            <Inp
              label="Insurance expiry"
              value={f.insuranceExpiry}
              onChange={(e) =>
                setF((x) => ({ ...x, insuranceExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="Plate expiry"
              value={f.plateExpiry}
              onChange={(e) =>
                setF((x) => ({ ...x, plateExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
            <Inp
              label="Permit expiry"
              value={f.permitExpiry}
              onChange={(e) =>
                setF((x) => ({ ...x, permitExpiry: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
            />
          </G2>
          <Inp
            label="Notes"
            value={f.notes}
            onChange={(e) =>
              setF((x) => ({ ...x, notes: e.target.value }))
            }
            placeholder="Optional notes"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              onClick={() => void saveAsset()}
              loading={busy}
              disabled={busy || !isAssetFormValid}
              loadingLabel="Saving…"
            >
              {editAsset ? 'SAVE CHANGES' : 'SAVE ASSET'}
            </Btn>
            <Btn variant="outline" disabled={busy} onClick={resetAssetForm}>
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
        list.map((a: FleetAsset) => {
          const compactUnitNo = isCompactIdentifier(a.unitNo);
          const assetName =
            [a.year, a.make, a.model].filter(Boolean).join(' ') ||
            humanizeEnum(a.type || 'asset');
          return (
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
              <div style={{ flex: 1, minWidth: 220 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: compactUnitNo ? 7 : 3,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: G.text,
                      lineHeight: 1.25,
                    }}
                  >
                    {assetName}
                  </span>
                  {compactUnitNo && (
                    <span
                      title={`Unit #${a.unitNo}`}
                      style={{
                        maxWidth: 180,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: G.goldBg,
                        fontSize: 12,
                        fontWeight: 800,
                        color: G.gold,
                        fontFamily: FONT_MONO,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      #{a.unitNo}
                    </span>
                  )}
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
                    (l) =>
                      ['assigned', 'in_transit'].includes(l.status) &&
                      (l.truckId === a.id || l.trailerId === a.id),
                  ) && <Pill color={G.gold}>IN USE</Pill>}
                  {(isExpired(a.insuranceExpiry) ||
                    isExpired(a.plateExpiry) ||
                    isExpired(a.permitExpiry)) && (
                    <Pill color={G.danger}>EXPIRED</Pill>
                  )}
                </div>
                {!compactUnitNo && (
                  <div
                    title={`Unit #${a.unitNo || '—'}`}
                    style={{
                      maxWidth: 420,
                      marginBottom: 5,
                      color: G.muted,
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Unit #{a.unitNo || '—'}
                  </div>
                )}
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
                <Btn size="sm" variant="outline" onClick={() => openEdit(a)}>
                  Edit
                </Btn>
                <Sel
                  compact
                  value={normalizeAssetStatus(a.status)}
                  onChange={(e) => void setAssetStatus(a.id, e.target.value)}
                  aria-label={`Status for ${a.unitNo || a.id}`}
                >
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {assetStatusLabel(s)}
                    </option>
                  ))}
                </Sel>
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
          );
        })
      )}
    </div>
  );
}
