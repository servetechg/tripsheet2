import { useEffect, useMemo, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, Divider } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { settlementsApi } from '@/lib/api';
import { blank } from '@/lib/format';

function statusColor(status: string) {
  if (status === 'paid') return G.success;
  if (status === 'approved') return G.info;
  return G.gold;
}

export function AccountingTab({
  company,
  drivers,
  sheets,
  apiEnabled,
}: {
  company: { id: string };
  drivers: any[];
  sheets: any[];
  apiEnabled?: boolean;
}) {
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    driverId: '',
    periodStart: '',
    periodEnd: '',
    currency: 'CAD',
    notes: '',
  });

  const load = async () => {
    if (!apiEnabled) return;
    try {
      const rows = await settlementsApi.list({ companyId: company.id });
      setList(rows);
    } catch (e: any) {
      notify(e?.message || 'Failed to load settlements', 'error');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

  const expensePreview = useMemo(() => {
    if (!f.driverId || !f.periodStart || !f.periodEnd) return [];
    const start = new Date(f.periodStart).getTime();
    const end = new Date(f.periodEnd).getTime();
    const lines: { label: string; amount: number; source: string }[] = [];
    for (const sheet of sheets.filter((s) => s.driverId === f.driverId)) {
      const created = sheet.createdAt ? new Date(sheet.createdAt).getTime() : NaN;
      if (Number.isFinite(created) && (created < start || created > end + 86400000)) {
        continue;
      }
      const expenses = Array.isArray(sheet.expenses) ? sheet.expenses : [];
      for (const ex of expenses) {
        const amount = Number(ex.amount);
        if (!Number.isFinite(amount) || amount === 0) continue;
        lines.push({
          label: `${ex.category || 'Expense'}: ${ex.description || ex.receiptNo || 'item'}`,
          amount,
          source: `sheet:${sheet.id}`,
        });
      }
    }
    return lines;
  }, [f.driverId, f.periodStart, f.periodEnd, sheets]);

  const create = async () => {
    setErr('');
    if (blank(f.driverId) || blank(f.periodStart) || blank(f.periodEnd)) {
      setErr('Driver and period dates are required.');
      return;
    }
    if (expensePreview.length === 0) {
      setErr('No trip-sheet expenses found for this driver/period. Add expenses on sheets first, or widen the period.');
      return;
    }
    const driver = drivers.find((d) => d.id === f.driverId);
    try {
      setBusy(true);
      await settlementsApi.create({
        companyId: company.id,
        driverId: f.driverId,
        driverName: driver?.name || '',
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
        currency: f.currency,
        notes: f.notes.trim(),
        lines: expensePreview,
      });
      setShow(false);
      setF({
        driverId: '',
        periodStart: '',
        periodEnd: '',
        currency: 'CAD',
        notes: '',
      });
      notify('Settlement draft created');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to create settlement');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await settlementsApi.approve(id);
      notify('Settlement approved');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Approve failed', 'error');
    }
  };

  const pay = async (id: string) => {
    try {
      await settlementsApi.pay(id);
      notify('Settlement marked paid');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Pay failed', 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      await settlementsApi.remove(id);
      notify('Draft deleted');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Delete failed', 'error');
    }
  };

  if (!apiEnabled) {
    return (
      <Card>
        <SectionTitle>Accounting</SectionTitle>
        <div style={{ color: G.muted, fontSize: 13 }}>
          API required for settlements.
        </div>
      </Card>
    );
  }

  const totalPreview = expensePreview.reduce((s, l) => s + l.amount, 0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <SectionTitle>Driver Settlements</SectionTitle>
        <Btn size="sm" onClick={() => setShow((v) => !v)}>
          {show ? 'Close' : '+ New settlement'}
        </Btn>
      </div>

      {show && (
        <Card style={{ marginBottom: 18 }}>
          <Err msg={err} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Sel
              label="Driver"
              value={f.driverId}
              onChange={(e) => setF((x) => ({ ...x, driverId: e.target.value }))}
            >
              <option value="">Select driver…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Sel>
            <Sel
              label="Currency"
              value={f.currency}
              onChange={(e) => setF((x) => ({ ...x, currency: e.target.value }))}
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </Sel>
            <Inp
              label="Period start"
              type="date"
              value={f.periodStart}
              onChange={(e) =>
                setF((x) => ({ ...x, periodStart: e.target.value }))
              }
            />
            <Inp
              label="Period end"
              type="date"
              value={f.periodEnd}
              onChange={(e) => setF((x) => ({ ...x, periodEnd: e.target.value }))}
            />
          </div>
          <Inp
            label="Notes"
            value={f.notes}
            onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))}
            placeholder="Optional"
          />
          <Divider />
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 8 }}>
            Lines from trip-sheet expenses in period ({expensePreview.length}) · total{' '}
            <strong style={{ color: G.text }}>
              {f.currency} {totalPreview.toFixed(2)}
            </strong>
          </div>
          {expensePreview.slice(0, 8).map((l, i) => (
            <div
              key={`${l.source}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '4px 0',
                color: G.text,
              }}
            >
              <span>{l.label}</span>
              <span>
                {f.currency} {l.amount.toFixed(2)}
              </span>
            </div>
          ))}
          {expensePreview.length > 8 && (
            <div style={{ fontSize: 11, color: G.muted }}>
              +{expensePreview.length - 8} more
            </div>
          )}
          <Btn
            full
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={() => void create()}
          >
            {busy ? 'Creating…' : 'Create draft settlement'}
          </Btn>
        </Card>
      )}

      {list.length === 0 ? (
        <div style={{ color: G.muted, fontSize: 13 }}>
          No settlements yet. Create one from driver trip-sheet expenses.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((s) => (
            <div
              key={s.id}
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: G.text }}>
                    {s.driverName || s.driverId}
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>
                    {String(s.periodStart).slice(0, 10)} →{' '}
                    {String(s.periodEnd).slice(0, 10)} · {s.currency}{' '}
                    {Number(s.totalAmount).toFixed(2)}
                  </div>
                </div>
                <Pill color={statusColor(s.status)}>{s.status}</Pill>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {s.status === 'draft' && (
                  <>
                    <Btn size="sm" onClick={() => void approve(s.id)}>
                      Approve
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => void remove(s.id)}
                    >
                      Delete
                    </Btn>
                  </>
                )}
                {s.status === 'approved' && (
                  <Btn size="sm" onClick={() => void pay(s.id)}>
                    Mark paid
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
