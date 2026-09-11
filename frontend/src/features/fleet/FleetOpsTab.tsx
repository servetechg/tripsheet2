import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, G2 } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank } from '@/lib/format';
import { maintenanceApi, dvirApi, auditApi, companiesApi } from '@/lib/api';

export function FleetOpsTab({
  company,
  assets,
  drivers,
  adminUser,
  apiEnabled,
}: any) {
  const [tab, setTab] = useState<'maintenance' | 'dvir' | 'expiry'>('maintenance');
  const [rows, setRows] = useState<any[]>([]);
  const [dvirs, setDvirs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [f, setF] = useState({
    assetId: '',
    type: 'pm',
    title: '',
    cost: '',
    performedAt: '',
    nextDueAt: '',
    vendor: '',
    vendorId: '',
  });
  const [d, setD] = useState({
    assetId: '',
    driverId: '',
    inspectedAt: '',
    status: 'satisfactory',
    remarks: '',
  });

  const load = async () => {
    if (!apiEnabled) return;
    try {
      const [m, v, vendorsList] = await Promise.all([
        maintenanceApi.list(company.id),
        dvirApi.list(company.id),
        companiesApi.maintenanceVendors(company.id, true).catch(() => []),
      ]);
      setRows(Array.isArray(m) ? m : []);
      setDvirs(Array.isArray(v) ? v : []);
      setVendors(vendorsList || []);
    } catch {
      notify('Could not load fleet ops', 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [company.id, apiEnabled]);

  const addMaintenance = async () => {
    if (blank(f.assetId) || blank(f.title) || blank(f.cost)) {
      notify('Asset, title, and cost required', 'error');
      return;
    }
    try {
      await maintenanceApi.create({
        companyId: company.id,
        ...f,
        cost: Number(f.cost),
      });
      await auditApi.create({
        companyId: company.id,
        actorId: adminUser?.sub || adminUser?.id,
        actorName: adminUser?.name,
        action: 'fleet.maintenance',
        entityType: 'maintenance',
        entityId: f.assetId,
        meta: { title: f.title, form: f },
      });
      setF({
        assetId: '',
        type: 'pm',
        title: '',
        cost: '',
        performedAt: '',
        nextDueAt: '',
        vendor: '',
        vendorId: '',
      });
      notify('Maintenance record saved');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Save failed', 'error');
    }
  };

  const addDvir = async () => {
    if (blank(d.assetId)) {
      notify('Asset required for DVIR', 'error');
      return;
    }
    try {
      await dvirApi.create({
        companyId: company.id,
        ...d,
        unitNo: assets.find((a: any) => a.id === d.assetId)?.unitNo,
        driverName: drivers.find((dr: any) => dr.id === d.driverId)?.name,
        defects: [],
      });
      notify('DVIR saved');
      await load();
    } catch (e: any) {
      notify(e?.message || 'DVIR failed', 'error');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const expiring = assets.filter((a: any) => {
    const dates = [a.insuranceExpiry, a.plateExpiry, a.permitExpiry].filter(
      Boolean,
    );
    return dates.some((dt: string) => dt <= today);
  });

  return (
    <div>
      <SectionTitle>Fleet Ops</SectionTitle>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['maintenance', 'dvir', 'expiry'] as const).map((t) => (
          <Btn
            key={t}
            size="sm"
            variant={tab === t ? 'primary' : 'outline'}
            onClick={() => setTab(t)}
          >
            {t}
          </Btn>
        ))}
      </div>

      {tab === 'maintenance' && (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <G2 cols={2}>
              <Sel
                label="Asset"
                value={f.assetId}
                onChange={(e: any) => setF({ ...f, assetId: e.target.value })}
              >
                <option value="">— select —</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.type} #{a.unitNo}
                  </option>
                ))}
              </Sel>
              <Sel
                label="Type"
                value={f.type}
                onChange={(e: any) => setF({ ...f, type: e.target.value })}
              >
                <option value="pm">Preventive (PM)</option>
                <option value="repair">Repair</option>
              </Sel>
              <Inp
                label="Title"
                value={f.title}
                onChange={(e: any) => setF({ ...f, title: e.target.value })}
                placeholder="e.g. Oil change"
              />
              <Inp
                label="Cost"
                value={f.cost}
                onChange={(e: any) => setF({ ...f, cost: e.target.value })}
                placeholder="e.g. 250.00"
              />
              <Inp
                label="Performed"
                value={f.performedAt}
                onChange={(e: any) => setF({ ...f, performedAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Inp
                label="Next due"
                value={f.nextDueAt}
                onChange={(e: any) => setF({ ...f, nextDueAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Sel
                label="Vendor"
                value={f.vendorId}
                onChange={(e: any) => {
                  const id = e.target.value;
                  const v = vendors.find((x: any) => x.id === id);
                  setF({ ...f, vendorId: id, vendor: v?.name || '' });
                }}
              >
                <option value="">— Optional —</option>
                {vendors.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Sel>
            </G2>
            <div style={{ marginTop: 14 }}>
              <Btn onClick={() => void addMaintenance()}>Save Maintenance</Btn>
            </div>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                borderTop: `1px solid ${G.border}`,
                padding: '10px 0',
                fontSize: 13,
              }}
            >
              <strong>
                {r.type.toUpperCase()} · #{r.unitNo}
              </strong>{' '}
              {r.title} · ${Number(r.cost).toFixed(2)} · {r.performedAt}
              {r.vendor ? ` · ${r.vendor}` : ''}
              {r.nextDueAt && (
                <span style={{ marginLeft: 8 }}>
                  <Pill>Next {r.nextDueAt}</Pill>
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === 'dvir' && (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <G2 cols={2}>
              <Sel
                label="Asset"
                value={d.assetId}
                onChange={(e: any) => setD({ ...d, assetId: e.target.value })}
              >
                <option value="">— select —</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.type} #{a.unitNo}
                  </option>
                ))}
              </Sel>
              <Sel
                label="Driver"
                value={d.driverId}
                onChange={(e: any) => setD({ ...d, driverId: e.target.value })}
              >
                <option value="">— optional —</option>
                {drivers.map((dr: any) => (
                  <option key={dr.id} value={dr.id}>
                    {dr.name}
                  </option>
                ))}
              </Sel>
              <Inp
                label="Inspected at"
                value={d.inspectedAt}
                onChange={(e: any) => setD({ ...d, inspectedAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Sel
                label="Status"
                value={d.status}
                onChange={(e: any) => setD({ ...d, status: e.target.value })}
              >
                <option value="satisfactory">Satisfactory</option>
                <option value="defects">Defects</option>
                <option value="out_of_service">Out of service</option>
              </Sel>
              <div style={{ gridColumn: '1 / -1' }}>
                <Inp
                  label="Remarks"
                  value={d.remarks}
                  onChange={(e: any) => setD({ ...d, remarks: e.target.value })}
                  placeholder="Optional inspection remarks or defects"
                />
              </div>
            </G2>
            <div style={{ marginTop: 14 }}>
              <Btn onClick={() => void addDvir()}>Save DVIR</Btn>
            </div>
          </div>
          {dvirs.map((r) => (
            <div
              key={r.id}
              style={{
                borderTop: `1px solid ${G.border}`,
                padding: '10px 0',
                fontSize: 13,
              }}
            >
              #{r.unitNo} · {r.status} · {r.inspectedAt} · {r.driverName}
            </div>
          ))}
        </Card>
      )}

      {tab === 'expiry' && (
        <Card>
          <SectionTitle>Insurance / plate / permit expiry</SectionTitle>
          {expiring.length === 0 && (
            <div style={{ color: G.muted, fontSize: 13 }}>
              No expired asset dates (set expiry fields on Assets).
            </div>
          )}
          {expiring.map((a: any) => (
            <div key={a.id} style={{ padding: '8px 0', fontSize: 13 }}>
              #{a.unitNo} ({a.type}) — insurance {a.insuranceExpiry || '—'} ·
              plate {a.plateExpiry || '—'} · permit {a.permitExpiry || '—'}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
