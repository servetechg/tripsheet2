import { useState } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import { Btn, Card, Inp, SectionTitle, Pill, G2, StatCard, StatsGrid, Icons } from '@/components/ui';
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
  const activeCount = list.filter((a: any) => a.status === 'active').length;
  const inactiveCount = list.length - activeCount;

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
          subtitle="Equipment"
          accent={G.purple}
          icon={Icons.assets({ size: 20, color: G.purple })}
        />
        <StatCard
          label="Active"
          value={activeCount}
          subtitle={`Current ${assetTab}`}
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          subtitle={`Current ${assetTab}`}
          accent={G.muted}
          icon={Icons.pending({ size: 20, color: G.muted })}
        />
      </StatsGrid>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(
          [
            ['trucks', 'TRUCKS', Icons.truck],
            ['trailers', 'TRAILERS', Icons.trailer],
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
          + ADD {assetTab === 'trucks' ? 'TRUCK' : 'TRAILER'}
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
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div>
            {(assetTab === 'trucks' ? Icons.truck : Icons.trailer)({
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
