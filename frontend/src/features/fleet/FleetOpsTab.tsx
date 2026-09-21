import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, G2 } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank, humanizeEnum, getApiErrorMessage } from '@/lib/format';
// getApiErrorMessage imported below
import { maintenanceApi, dvirApi, auditApi, companiesApi } from '@/lib/api';
import type { FleetOpsTabProps } from '@/types/tabs';
import type {
  DvirRecordDto,
  MaintenanceRecordDto,
  MdmRecord,
} from '@/types/dtos';

export function FleetOpsTab({
  company,
  assets,
  drivers,
  adminUser,
  apiEnabled,
}: FleetOpsTabProps) {
  const [tab, setTab] = useState<'maintenance' | 'dvir' | 'expiry'>('maintenance');
  const [rows, setRows] = useState<MaintenanceRecordDto[]>([]);
  const [dvirs, setDvirs] = useState<DvirRecordDto[]>([]);
  const [vendors, setVendors] = useState<MdmRecord[]>([]);
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
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Save failed'), 'error');
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
        unitNo: assets.find((a) => a.id === d.assetId)?.unitNo,
        driverName: drivers.find((dr) => dr.id === d.driverId)?.name,
        defects: [],
      });
      notify('DVIR saved');
      await load();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'DVIR failed'), 'error');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const expiring = assets.filter((a) => {
    const dates = [a.insuranceExpiry, a.plateExpiry, a.permitExpiry].filter(
      Boolean,
    );
    return dates.some((dt) => dt != null && dt <= today);
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
            {humanizeEnum(t, { dvir: 'DVIR' })}
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
                onChange={(e) => setF({ ...f, assetId: e.target.value })}
              >
                <option value="">— select —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {humanizeEnum(a.type)} #{a.unitNo}
                  </option>
                ))}
              </Sel>
              <Sel
                label="Type"
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value })}
              >
                <option value="pm">Preventive (PM)</option>
                <option value="repair">Repair</option>
              </Sel>
              <Inp
                label="Title"
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                placeholder="e.g. Oil change"
              />
              <Inp
                label="Cost"
                value={f.cost}
                onChange={(e) => setF({ ...f, cost: e.target.value })}
                placeholder="e.g. 250.00"
              />
              <Inp
                label="Performed"
                value={f.performedAt}
                onChange={(e) => setF({ ...f, performedAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Inp
                label="Next due"
                value={f.nextDueAt}
                onChange={(e) => setF({ ...f, nextDueAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Sel
                label="Vendor"
                value={f.vendorId}
                onChange={(e) => {
                  const id = e.target.value;
                  const v = vendors.find((x) => x.id === id);
                  setF({ ...f, vendorId: id, vendor: v?.name || '' });
                }}
              >
                <option value="">— Optional —</option>
                {vendors.map((v) => (
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
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: G.text }}>{r.title}</div>
                <div style={{ color: G.muted, marginTop: 4 }}>
                  <Pill>{humanizeEnum(r.type, { pm: 'Preventive maintenance' })}</Pill>
                  <span style={{ marginLeft: 8 }}>
                    #{r.unitNo} · {r.performedAt || 'Date not recorded'}
                    {r.vendor ? ` · ${r.vendor}` : ''}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>${Number(r.cost).toFixed(2)}</strong>
                {r.nextDueAt && (
                  <div style={{ marginTop: 4 }}>
                    <Pill>Next {r.nextDueAt}</Pill>
                  </div>
                )}
              </div>
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
                onChange={(e) => setD({ ...d, assetId: e.target.value })}
              >
                <option value="">— select —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {humanizeEnum(a.type)} #{a.unitNo}
                  </option>
                ))}
              </Sel>
              <Sel
                label="Driver"
                value={d.driverId}
                onChange={(e) => setD({ ...d, driverId: e.target.value })}
              >
                <option value="">— optional —</option>
                {drivers.map((dr) => (
                  <option key={dr.id} value={dr.id}>
                    {dr.name}
                  </option>
                ))}
              </Sel>
              <Inp
                label="Inspected at"
                value={d.inspectedAt}
                onChange={(e) => setD({ ...d, inspectedAt: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
              <Sel
                label="Status"
                value={d.status}
                onChange={(e) => setD({ ...d, status: e.target.value })}
              >
                <option value="satisfactory">Satisfactory</option>
                <option value="defects">Defects</option>
                <option value="out_of_service">Out of service</option>
              </Sel>
              <div style={{ gridColumn: '1 / -1' }}>
                <Inp
                  label="Remarks"
                  value={d.remarks}
                  onChange={(e) => setD({ ...d, remarks: e.target.value })}
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
              #{r.unitNo} · {humanizeEnum(r.status)} · {r.inspectedAt} · {r.driverName}
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
          {expiring.map((a) => (
            <div key={a.id} style={{ padding: '8px 0', fontSize: 13 }}>
              #{a.unitNo} ({humanizeEnum(a.type)}) — insurance {a.insuranceExpiry || '—'} ·
              plate {a.plateExpiry || '—'} · permit {a.permitExpiry || '—'}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
