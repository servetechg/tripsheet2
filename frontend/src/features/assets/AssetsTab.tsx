import { useState } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import { Btn, Card, Inp, SectionTitle, Pill, G2, Icons, StatsGrid } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { assetsApi } from '@/lib/api';

export function AssetsTab({
  company,
  assets,
  setAssets,
  loads,
  apiEnabled,
  refreshAll,
}: any) {
  const [assetTab, setAssetTab] = useState('trucks');
  const [show, setShow] = useState(false);
  const [f, setF] = useState({
    type: 'truck',
    unitNo: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    plate: '',
    notes: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const myTrucks = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'truck',
  );
  const myTrailers = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'trailer',
  );
  const list = assetTab === 'trucks' ? myTrucks : myTrailers;

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
    const type = assetTab === 'trucks' ? 'truck' : 'trailer';
    const body = {
      ...f,
      type,
      status: 'active' as const,
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
      setF({
        type: 'truck',
        unitNo: '',
        year: '',
        make: '',
        model: '',
        vin: '',
        plate: '',
        notes: '',
      });
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
                  status: a.status === 'active' ? 'inactive' : 'active',
                }
              : a,
          ),
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Toggle failed', 'error');
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

  const activeTrucks = myTrucks.filter((a: any) => a.status === 'active').length;
  const activeTrailers = myTrailers.filter((a: any) => a.status === 'active').length;
  const inUse = loads.filter((l: any) =>
    ['assigned', 'in_transit'].includes(l.status),
  ).length;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: G.text }}>Assets</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
          Maintain trucks and trailers in your fleet.
        </div>
      </div>

      <StatsGrid
        items={[
          {
            label: 'Trucks',
            value: myTrucks.length,
            accent: G.primary,
            icon: Icons.truck({ size: 20 }),
            subtitle: `${activeTrucks} active`,
          },
          {
            label: 'Trailers',
            value: myTrailers.length,
            accent: G.info,
            icon: Icons.inventory({ size: 20 }),
            subtitle: `${activeTrailers} active`,
          },
          {
            label: 'In Use',
            value: inUse,
            accent: G.warning || G.gold,
            icon: Icons.play({ size: 20 }),
            subtitle: 'On active loads',
          },
          {
            label: 'Fleet Total',
            value: myTrucks.length + myTrailers.length,
            accent: G.success,
            icon: Icons.dashboard({ size: 20 }),
          },
        ]}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { id: 'trucks', label: 'Trucks', icon: Icons.truck({ size: 16 }) },
          { id: 'trailers', label: 'Trailers', icon: Icons.inventory({ size: 16 }) },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className="ts-btn"
            onClick={() => {
              setAssetTab(t.id);
              setShow(false);
            }}
            style={{
              background: assetTab === t.id ? G.primary : G.card,
              color: assetTab === t.id ? G.onPrimary : G.muted2,
              border: `1px solid ${assetTab === t.id ? G.primary : G.border}`,
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'inherit',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <Btn
          style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}
          onClick={() => {
            setShow(true);
            setErr('');
          }}
        >
          Add {assetTab === 'trucks' ? 'Truck' : 'Trailer'}
        </Btn>
      </div>

      {show && (
        <Card>
          <SectionTitle>
            ADD {assetTab === 'trucks' ? 'TRUCK' : 'TRAILER'}
          </SectionTitle>
          <Err msg={err} />
          <G2 cols={2}>
            <Inp
              label="Unit No. *"
              value={f.unitNo}
              onChange={(e: any) =>
                setF((x) => ({ ...x, unitNo: e.target.value }))
              }
              placeholder="e.g. 32054"
            />
            <Inp
              label="Year"
              value={f.year}
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
              onChange={(e: any) =>
                setF((x) => ({ ...x, make: e.target.value }))
              }
              placeholder={
                assetTab === 'trucks' ? 'e.g. Kenworth' : 'e.g. Stoughton'
              }
            />
            <Inp
              label="Model"
              value={f.model}
              onChange={(e: any) =>
                setF((x) => ({ ...x, model: e.target.value }))
              }
              placeholder={
                assetTab === 'trucks' ? 'e.g. T680' : 'e.g. 53ft Dry Van'
              }
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="VIN"
              value={f.vin}
              onChange={(e: any) =>
                setF((x) => ({ ...x, vin: e.target.value }))
              }
              placeholder="Vehicle ID number"
            />
            <Inp
              label="Plate No."
              value={f.plate}
              onChange={(e: any) =>
                setF((x) => ({ ...x, plate: e.target.value }))
              }
              placeholder="e.g. AB-32054"
            />
          </G2>
          <Inp
            label="Notes"
            value={f.notes}
            onChange={(e: any) =>
              setF((x) => ({ ...x, notes: e.target.value }))
            }
            placeholder="Optional notes"
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
            {assetTab === 'trucks'
              ? Icons.truck({ size: 24 })
              : Icons.inventory({ size: 24 })}
          </div>
          <div style={{ color: G.muted, marginTop: 10, fontSize: 14 }}>
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
                  <Pill color={a.status === 'active' ? G.success : G.muted}>
                    {a.status.toUpperCase()}
                  </Pill>
                  {loads.find(
                    (l: any) =>
                      ['assigned', 'in_transit'].includes(l.status) &&
                      (l.truckId === a.id || l.trailerId === a.id),
                  ) && <Pill color={G.gold}>IN USE</Pill>}
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
                {a.vin && (
                  <div style={{ fontSize: 10, color: G.muted }}>
                    VIN: <span style={{ fontFamily: FONT_MONO }}>{a.vin}</span>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleStatus(a.id)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${
                      a.status === 'active' ? G.muted : G.success
                    }`,
                    color: a.status === 'active' ? G.muted : G.success,
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {a.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
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
                  }}
                >
                  🗑 REMOVE
                </button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
