import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { assetsApi, driversApi } from '@/lib/api';
import {
  AVAILABILITY_LABELS,
  SAFETY_EVENT_LABELS,
  SAFETY_EVENT_TYPES,
  TRAINING_COURSES,
} from '@/lib/driverLifecycle';

export function DriverEquipmentPanel({
  recordId,
  companyId,
  apiEnabled,
  refreshAll,
}: {
  recordId: string;
  companyId: string;
  apiEnabled?: boolean;
  refreshAll?: () => Promise<void>;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [truckId, setTruckId] = useState('');
  const [trailerId, setTrailerId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!apiEnabled || !recordId) return;
    try {
      const [assignments, ast] = await Promise.all([
        driversApi.equipmentAssignments(recordId),
        assetsApi.list(companyId),
      ]);
      setRows(Array.isArray(assignments) ? assignments : []);
      setAssets(Array.isArray(ast) ? ast : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, apiEnabled, companyId]);

  const assign = async (assetType: 'truck' | 'trailer', assetId: string) => {
    if (!assetId) return;
    try {
      setBusy(true);
      await driversApi.assignEquipment(recordId, {
        companyId,
        assetId,
        assetType,
        role: 'primary',
      });
      await load();
      await refreshAll?.();
      notify(`${assetType} assigned`);
    } catch (e: any) {
      notify(e?.message || 'Assign failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const trucks = assets.filter((a) => a.type === 'truck');
  const trailers = assets.filter((a) => a.type === 'trailer');

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: G.muted, marginBottom: 12 }}>
        EQUIPMENT ASSIGNMENT HISTORY
      </div>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Sel label="Primary truck" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
              <option value="">—</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.unitNo || t.id}
                </option>
              ))}
            </Sel>
            <Btn
              size="sm"
              style={{ marginTop: 8 }}
              disabled={busy || !truckId}
              onClick={() => void assign('truck', truckId)}
            >
              Assign truck
            </Btn>
          </div>
          <div>
            <Sel label="Primary trailer" value={trailerId} onChange={(e) => setTrailerId(e.target.value)}>
              <option value="">—</option>
              {trailers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.unitNo || t.id}
                </option>
              ))}
            </Sel>
            <Btn
              size="sm"
              style={{ marginTop: 8 }}
              disabled={busy || !trailerId}
              onClick={() => void assign('trailer', trailerId)}
            >
              Assign trailer
            </Btn>
          </div>
        </div>
      </Card>
      {rows.length === 0 ? (
        <Card style={{ padding: 24, textAlign: 'center', color: G.muted }}>
          No equipment assignments yet.
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: G.text }}>
                  {r.assetType.toUpperCase()} · {r.unitNo || r.assetId.slice(0, 8)}
                </div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
                  {r.role} · from {new Date(r.assignedAt).toLocaleDateString('en-CA')}
                  {r.unassignedAt
                    ? ` → ${new Date(r.unassignedAt).toLocaleDateString('en-CA')}`
                    : ' · active'}
                </div>
              </div>
              <Pill color={r.unassignedAt ? G.muted : G.success}>
                {r.unassignedAt ? 'Closed' : 'Active'}
              </Pill>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

export function DriverSafetyPanel({
  recordId,
  companyId,
  apiEnabled,
}: {
  recordId: string;
  companyId: string;
  apiEnabled?: boolean;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: 'incident',
    occurredAt: new Date().toISOString().slice(0, 10),
    description: '',
    preventable: false,
  });

  const load = async () => {
    if (!apiEnabled) return;
    try {
      const list = await driversApi.safetyEvents(recordId);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, [recordId, apiEnabled]);

  const add = async () => {
    if (!form.description.trim()) {
      notify('Description required', 'error');
      return;
    }
    try {
      await driversApi.createSafetyEvent(recordId, {
        companyId,
        ...form,
      });
      setForm((f) => ({ ...f, description: '' }));
      await load();
      notify('Safety event recorded');
    } catch (e: any) {
      notify(e?.message || 'Failed', 'error');
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <Sel label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
          {SAFETY_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {SAFETY_EVENT_LABELS[t]}
            </option>
          ))}
        </Sel>
        <Inp
          label="Date"
          type="date"
          value={form.occurredAt}
          onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
        />
        <Inp
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <Btn size="sm" onClick={() => void add()}>
          Add event
        </Btn>
      </Card>
      {rows.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>
            {SAFETY_EVENT_LABELS[r.type as keyof typeof SAFETY_EVENT_LABELS] || r.type}
          </div>
          <div style={{ fontSize: 11, color: G.muted }}>{r.occurredAt}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{r.description}</div>
        </Card>
      ))}
    </div>
  );
}

export function DriverTrainingPanel({
  recordId,
  companyId,
  apiEnabled,
}: {
  recordId: string;
  companyId: string;
  apiEnabled?: boolean;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    courseCode: 'orientation',
    completedAt: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    instructor: '',
  });

  const load = async () => {
    if (!apiEnabled) return;
    try {
      const list = await driversApi.trainingRecords(recordId);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, [recordId, apiEnabled]);

  const add = async () => {
    try {
      const course = TRAINING_COURSES.find((c) => c.code === form.courseCode);
      await driversApi.createTrainingRecord(recordId, {
        companyId,
        courseCode: form.courseCode,
        courseName: course?.name,
        completedAt: form.completedAt,
        expiryDate: form.expiryDate || undefined,
        instructor: form.instructor || undefined,
      });
      await load();
      notify('Training record added');
    } catch (e: any) {
      notify(e?.message || 'Failed', 'error');
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <Sel
          label="Course"
          value={form.courseCode}
          onChange={(e) => setForm((f) => ({ ...f, courseCode: e.target.value }))}
        >
          {TRAINING_COURSES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Sel>
        <Inp
          label="Completed"
          type="date"
          value={form.completedAt}
          onChange={(e) => setForm((f) => ({ ...f, completedAt: e.target.value }))}
        />
        <Inp
          label="Expiry (optional)"
          type="date"
          value={form.expiryDate}
          onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
        />
        <Btn size="sm" onClick={() => void add()}>
          Add record
        </Btn>
      </Card>
      {rows.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{r.courseName || r.courseCode}</div>
          <div style={{ fontSize: 11, color: G.muted }}>
            Completed {r.completedAt}
            {r.expiryDate ? ` · Expires ${r.expiryDate}` : ''}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DriverPerformancePanel({
  recordId,
  apiEnabled,
}: {
  recordId: string;
  apiEnabled?: boolean;
}) {
  const [perf, setPerf] = useState<any>(null);

  useEffect(() => {
    if (!apiEnabled || !recordId) return;
    let cancelled = false;
    driversApi
      .performance(recordId)
      .then((p) => {
        if (!cancelled) setPerf(p);
      })
      .catch(() => {
        if (!cancelled) setPerf(null);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, apiEnabled]);

  if (!perf) {
    return <Card style={{ padding: 24, color: G.muted }}>Loading performance…</Card>;
  }

  const items = [
    ['Total miles', perf.totalMiles],
    ['Deliveries', perf.deliveriesCompleted],
    ['On-time %', perf.onTimePct != null ? `${perf.onTimePct}%` : '—'],
    ['Revenue (loads)', `$${Number(perf.revenue || 0).toFixed(0)}`],
    ['In transit', perf.inTransit],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
      {items.map(([label, value]) => (
        <Card key={label as string}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: G.muted }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: G.gold, marginTop: 4 }}>
            {value}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AvailabilityBadge({ status }: { status?: string }) {
  const s = status || 'available';
  return (
    <Pill color={s === 'available' ? G.success : G.warning}>
      {AVAILABILITY_LABELS[s as keyof typeof AVAILABILITY_LABELS] || s}
    </Pill>
  );
}
