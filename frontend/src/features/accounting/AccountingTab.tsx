import { useEffect, useMemo, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, Divider, Skeleton } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { settlementsApi, contractsApi } from '@/lib/api';
import { blank, formatLoadLabel, humanizeEnum, getApiErrorMessage } from '@/lib/format';
// getApiErrorMessage imported below
import { matchesDriverRef, driverRecordIdOf } from '@/lib/driverIds';
import { PAY_TYPES } from '@/lib/docTypes';
import type { SettlementLine } from '@tripsheet/shared';
import { BillingPanel } from './BillingPanel';

function statusColor(status: string) {
  if (status === 'paid') return G.success;
  if (status === 'approved') return G.info;
  return G.gold;
}

export function AccountingTab({
  company,
  drivers,
  sheets,
  loads = [],
  adminUser,
  apiEnabled,
}: import('@/types/tabs').AccountingTabProps) {
  const [list, setList] = useState<import('@tripsheet/shared').Settlement[]>([]);
  const [loadingList, setLoadingList] = useState(Boolean(apiEnabled));
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wageContract, setWageContract] =
    useState<import('@/types/dtos').EmploymentContractDto | null>(null);
  const [f, setF] = useState({
    driverId: '',
    periodStart: '',
    periodEnd: '',
    currency: 'CAD',
    notes: '',
  });

  const selectedDriver = drivers.find((d) => d.id === f.driverId);
  const driverRecordId = selectedDriver
    ? driverRecordIdOf(selectedDriver)
    : f.driverId;

  const load = async () => {
    if (!apiEnabled) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      const rows = await settlementsApi.list({ companyId: company.id });
      setList(rows);
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Failed to load settlements'), 'error');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

  useEffect(() => {
    if (!apiEnabled || !driverRecordId) {
      setWageContract(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await contractsApi.list(driverRecordId);
        if (!cancelled) setWageContract(Array.isArray(rows) && rows.length ? rows[0] : null);
      } catch {
        if (!cancelled) setWageContract(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, driverRecordId]);

  const settlementPreview = useMemo(() => {
    if (!f.driverId || !f.periodStart || !f.periodEnd) return [] as SettlementLine[];
    const start = new Date(f.periodStart).getTime();
    const end = new Date(f.periodEnd).getTime() + 86400000;
    const lines: SettlementLine[] = [];

    if (wageContract?.payType) {
      const pt = PAY_TYPES.find((p) => p.id === wageContract.payType);
      lines.push({
        label: `Wage terms: ${pt?.label || humanizeEnum(wageContract.payType)} @ ${wageContract.payRate || '—'} ${wageContract.payUnit || pt?.unit || ''} (informational — auto-pay deferred)`,
        amount: 0,
        kind: 'wage_info',
        source: `contract:${wageContract.id || 'active'}`,
      });
    }

    for (const sheet of sheets.filter((s) => matchesDriverRef(s.driverId, { id: f.driverId, driverRecordId }))) {
      const created = sheet.createdAt ? new Date(sheet.createdAt).getTime() : NaN;
      if (Number.isFinite(created) && (created < start || created > end)) continue;
      const expenses = Array.isArray(sheet.expenses) ? sheet.expenses : [];
      for (const ex of expenses) {
        const amount = Number(ex.amount);
        if (!Number.isFinite(amount) || amount === 0) continue;
        lines.push({
          label: `${humanizeEnum(ex.category || 'Expense')}: ${ex.description || ex.receiptNo || 'item'}`,
          amount,
          kind: 'expense',
          tripSheetId: sheet.id,
          source: `sheet:${sheet.id}`,
        });
      }
    }

    for (const load of loads.filter((l) => matchesDriverRef(l.driverId, { id: f.driverId, driverRecordId }))) {
      const loadMeta = load as import('@/types/app').LoadWithTimestamps;
      const ts = load.pickupTime || loadMeta.createdAt || load.lastUpdate;
      const t = ts ? new Date(ts).getTime() : NaN;
      if (!Number.isFinite(t) || t < start || t > end) continue;
      if (load.status !== 'delivered') continue;
      const miles = Number(load.miles) || 0;
      lines.push({
        label: `${formatLoadLabel(load)} (${miles} mi)`,
        amount: 0,
        kind: 'load_summary',
        loadId: load.id,
        source: `load:${load.id}`,
      });
    }

    return lines;
  }, [f.driverId, f.periodStart, f.periodEnd, sheets, loads, wageContract, driverRecordId]);

  const expenseTotal = settlementPreview
    .filter((l) => l.kind === 'expense')
    .reduce((s, l) => s + l.amount, 0);

  const settlementDriverName = (
    settlement: import('@tripsheet/shared').Settlement,
  ) => {
    if (settlement.driverName) return settlement.driverName;
    const driver = drivers.find((d) =>
      matchesDriverRef(settlement.driverId, {
        id: d.id,
        driverRecordId: driverRecordIdOf(d),
      }),
    );
    return driver?.name || 'Driver not available';
  };

  const tripSheetLabel = (tripSheetId: string) => {
    const sheet = sheets.find((item) => item.id === tripSheetId);
    const tripNumbers = (sheet?.trips || [])
      .map((trip) => trip.tripNo)
      .filter(Boolean);
    return tripNumbers.length
      ? `Trip ${tripNumbers.map((tripNo: string) => `#${tripNo}`).join(', ')}`
      : 'Trip sheet';
  };

  const create = async () => {
    setErr('');
    if (blank(f.driverId) || blank(f.periodStart) || blank(f.periodEnd)) {
      setErr('Driver and period dates are required.');
      return;
    }
    const payableLines = settlementPreview.filter((l) => l.kind === 'expense');
    if (payableLines.length === 0 && !wageContract?.payType) {
      setErr(
        'No trip-sheet expenses or wage contract found for this driver/period. Add expenses on sheets, set wage on driver profile, or widen the period.',
      );
      return;
    }
    const linesToSave =
      payableLines.length > 0
        ? settlementPreview
        : settlementPreview.filter((l) => l.kind === 'wage_info');
    try {
      setBusy(true);
      await settlementsApi.create({
        companyId: company.id,
        driverId: f.driverId,
        driverName: selectedDriver?.name || '',
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
        currency: f.currency,
        notes: f.notes.trim(),
        lines: linesToSave,
      });
      setShow(false);
      setF({
        driverId: '',
        periodStart: '',
        periodEnd: '',
        currency: 'CAD',
        notes: '',
      });
      setWageContract(null);
      notify('Settlement draft created');
      await load();
    } catch (e: unknown) {
      setErr(getApiErrorMessage(e, 'Failed to create settlement'));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await settlementsApi.approve(id);
      notify('Settlement approved');
      await load();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Approve failed'), 'error');
    }
  };

  const pay = async (id: string) => {
    try {
      await settlementsApi.pay(id);
      notify('Settlement marked paid');
      await load();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Pay failed'), 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      await settlementsApi.remove(id);
      notify('Draft deleted');
      await load();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Delete failed'), 'error');
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
          {wageContract?.payType && (
            <div
              style={{
                background: G.infoTint,
                border: `1px solid ${G.info}44`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                fontSize: 12,
                color: G.text,
              }}
            >
              <strong>Contract wage (read-only preview)</strong>
              <div style={{ marginTop: 6, color: G.muted }}>
                {PAY_TYPES.find((p) => p.id === wageContract.payType)?.label ||
                  humanizeEnum(wageContract.payType)}{' '}
                · {wageContract.payRate} {wageContract.payUnit || ''}
                {wageContract.detentionRate
                  ? ` · Detention ${wageContract.detentionRate}`
                  : ''}
              </div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>
                Full rate engine / auto-pay is deferred — expenses below are
                what settle today.
              </div>
            </div>
          )}
          <Divider />
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 8 }}>
            Preview ({settlementPreview.length} lines) · expense total{' '}
            <strong style={{ color: G.text }}>
              {f.currency} {expenseTotal.toFixed(2)}
            </strong>
          </div>
          {settlementPreview.slice(0, 10).map((l, i) => (
            <div
              key={`${l.source}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '4px 0',
                color: l.kind === 'wage_info' ? G.info : G.text,
              }}
            >
              <span>
                {l.label}
                {l.tripSheetId && (
                  <span style={{ color: G.muted, fontSize: 10 }}>
                    {' '}
                    · {tripSheetLabel(l.tripSheetId)}
                  </span>
                )}
              </span>
              <span>
                {l.amount === 0 ? '—' : `${f.currency} ${l.amount.toFixed(2)}`}
              </span>
            </div>
          ))}
          {settlementPreview.length > 10 && (
            <div style={{ fontSize: 11, color: G.muted }}>
              +{settlementPreview.length - 10} more
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

      {loadingList ? (
        <div>
          <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
            Loading settlements…
          </div>
          <Skeleton rows={3} height={74} />
        </div>
      ) : list.length === 0 ? (
        <div style={{ color: G.muted, fontSize: 13 }}>
          No settlements yet. Create one from driver trip-sheet expenses and
          contract wage preview.
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
                    {settlementDriverName(s)}
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>
                    {String(s.periodStart).slice(0, 10)} →{' '}
                    {String(s.periodEnd).slice(0, 10)} · {s.currency}{' '}
                    {Number(s.totalAmount).toFixed(2)}
                  </div>
                </div>
                <Pill color={statusColor(s.status)}>{humanizeEnum(s.status)}</Pill>
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

      <div style={{ marginTop: 24 }}>
        <BillingPanel
          company={company}
          drivers={drivers}
          sheets={sheets}
          loads={loads}
          adminUser={adminUser}
          apiEnabled={apiEnabled}
        />
      </div>
    </div>
  );
}
