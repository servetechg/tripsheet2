import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank } from '@/lib/format';
import { maintenanceApi, dvirApi, auditApi } from '@/lib/api';

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
  const [f, setF] = useState({
    assetId: '',
    type: 'pm',
    title: '',
    cost: '',
    performedAt: '',
    nextDueAt: '',
    vendor: '',
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
      const [m, v] = await Promise.all([
        maintenanceApi.list(company.id),
        dvirApi.list(company.id),
      ]);
      setRows(m);
      setDvirs(v);
    } catch (e: any) {
      notify(e?.message || 'Failed to load fleet ops', 'error');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

  const addMaintenance = async () => {
    if (blank(f.assetId) || blank(f.title) || blank(f.performedAt)) {
      notify('Asset, title, and date are required', 'error');
      return;
    }
    const asset = assets.find((a: any) => a.id === f.assetId);
    try {
      await maintenanceApi.create({
        companyId: company.id,
        assetId: f.assetId,
        unitNo: asset?.unitNo || '',
        type: f.type,
        title: f.title,
        cost: Number(f.cost || 0),
        performedAt: f.performedAt,
        nextDueAt: f.nextDueAt || null,
        vendor: f.vendor,
      });
      await auditApi.create({
        companyId: company.id,
        actorId: adminUser?.id,
        actorName: adminUser?.name,
        action: 'maintenance.create',
        entityType: 'maintenance',
        entityId: f.assetId,
      });
      notify('Maintenance saved');
      setF({
        assetId: '',
        type: 'pm',
        title: '',
        cost: '',
        performedAt: '',
        nextDueAt: '',
        vendor: '',
      });
      await load();
    } catch (e: any) {
      notify(e?.message || 'Save failed', 'error');
    }
  };

  const addDvir = async () => {
    if (blank(d.assetId) || blank(d.inspectedAt)) {
      notify('Asset and inspection date required', 'error');
      return;
    }
    const asset = assets.find((a: any) => a.id === d.assetId);
    const driver = drivers.find((x: any) => x.id === d.driverId);
    try {
      await dvirApi.create({
        companyId: company.id,
        assetId: d.assetId,
        unitNo: asset?.unitNo || '',
        driverId: d.driverId || null,
        driverName: driver?.name || '',
        inspectedAt: d.inspectedAt,
        status: d.status,
        remarks: d.remarks,
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
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
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
            />
            <Inp
              label="Cost"
              value={f.cost}
              onChange={(e: any) => setF({ ...f, cost: e.target.value })}
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
            <Btn onClick={() => void addMaintenance()}>Save maintenance</Btn>
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
          <Inp
            label="Remarks"
            value={d.remarks}
            onChange={(e: any) => setD({ ...d, remarks: e.target.value })}
          />
          <Btn onClick={() => void addDvir()}>Save DVIR</Btn>
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
