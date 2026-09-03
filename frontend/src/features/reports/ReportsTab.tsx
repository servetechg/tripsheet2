import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, SectionTitle, Pill } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { reportsApi, notificationsApi } from '@/lib/api';

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: G.muted,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: G.text, lineHeight: 1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 8 }}>{hint}</div>
      )}
    </div>
  );
}

export function ReportsTab({
  company,
  apiEnabled,
}: {
  company: { id: string; shortName?: string };
  apiEnabled?: boolean;
}) {
  const [summary, setSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [smsLog, setSmsLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'ops' | 'analytics'>('ops');

  const load = async () => {
    if (!apiEnabled) return;
    setLoading(true);
    try {
      const [s, a, n] = await Promise.all([
        reportsApi.summary(company.id),
        reportsApi.analytics(company.id),
        notificationsApi.list(company.id, 20),
      ]);
      setSummary(s);
      setAnalytics(a);
      setSmsLog(n);
    } catch (e: any) {
      notify(e?.message || 'Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

  if (!apiEnabled) {
    return (
      <Card>
        <SectionTitle>Reports</SectionTitle>
        <div style={{ color: G.muted, fontSize: 13 }}>API required for reports.</div>
      </Card>
    );
  }

  const aging = analytics?.invoiceAging;
  const otp = analytics?.onTimePerformance;

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
        <SectionTitle>Reports</SectionTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            size="sm"
            variant={view === 'ops' ? 'primary' : 'outline'}
            onClick={() => setView('ops')}
          >
            Ops
          </Btn>
          <Btn
            size="sm"
            variant={view === 'analytics' ? 'primary' : 'outline'}
            onClick={() => setView('analytics')}
          >
            Analytics
          </Btn>
          <Btn size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Btn>
        </div>
      </div>

      {view === 'ops' && (
        <>
          {!summary ? (
            <div style={{ color: G.muted, fontSize: 13 }}>
              {loading ? 'Loading…' : 'No data yet.'}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <Stat
                  label="Loads"
                  value={summary.loads.total}
                  hint={`${summary.loads.inTransit} in transit`}
                />
                <Stat label="Delivered" value={summary.loads.delivered} />
                <Stat label="Drivers (active ops)" value={summary.drivers} />
                <Stat
                  label="Fleet"
                  value={summary.fleet.activeAssets}
                  hint={`${summary.fleet.trucks} trucks · ${summary.fleet.trailers} trailers`}
                />
                <Stat label="Trip sheets" value={summary.tripSheets} />
                <Stat
                  label="Expenses"
                  value={`${Number(summary.expenseTotal || 0).toFixed(2)}`}
                  hint="From trip sheet line items"
                />
                <Stat
                  label="Settlements paid"
                  value={summary.settlements.paid}
                  hint={`${Number(summary.settlements.paidAmount || 0).toFixed(2)} paid`}
                />
              </div>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: G.muted, marginBottom: 10 }}>
                  Load mix · generated {new Date(summary.generatedAt).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Pill color={G.info}>Assigned {summary.loads.assigned}</Pill>
                  <Pill color={G.gold}>In transit {summary.loads.inTransit}</Pill>
                  <Pill color={G.success}>Delivered {summary.loads.delivered}</Pill>
                  <Pill color={G.danger}>Cancelled {summary.loads.cancelled}</Pill>
                  <Pill color={G.muted}>
                    Settlements draft {summary.settlements.draft} · approved{' '}
                    {summary.settlements.approved}
                  </Pill>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {view === 'analytics' && (
        <>
          {!analytics ? (
            <div style={{ color: G.muted, fontSize: 13 }}>
              {loading ? 'Loading…' : 'No analytics yet. Add load rates and invoices.'}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <Stat
                  label="Gross margin"
                  value={`$${Number(analytics.grossMargin || 0).toFixed(0)}`}
                  hint={`${Number(analytics.grossMarginPct || 0).toFixed(1)}%`}
                />
                <Stat
                  label="CPM (cost/mi)"
                  value={Number(analytics.costPerMile || 0).toFixed(2)}
                />
                <Stat
                  label="Fuel spend"
                  value={`$${Number(analytics.fuelSpend || 0).toFixed(0)}`}
                />
                <Stat
                  label="Driver pay"
                  value={`$${Number(analytics.driverPay || 0).toFixed(0)}`}
                />
                <Stat
                  label="OTP"
                  value={`${Number(otp?.pct || 0).toFixed(0)}%`}
                  hint={`${otp?.onTime || 0} on time · ${otp?.late || 0} late`}
                />
                <Stat
                  label="AR unpaid"
                  value={`$${Number(aging?.unpaidTotal || 0).toFixed(0)}`}
                />
              </div>

              <Card style={{ marginBottom: 16 }}>
                <SectionTitle>Invoice aging</SectionTitle>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                  <Pill>Current ${Number(aging?.current || 0).toFixed(0)}</Pill>
                  <Pill>1–30 ${Number(aging?.days30 || 0).toFixed(0)}</Pill>
                  <Pill>31–60 ${Number(aging?.days60 || 0).toFixed(0)}</Pill>
                  <Pill>90+ ${Number(aging?.days90Plus || 0).toFixed(0)}</Pill>
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <SectionTitle>Revenue by lane</SectionTitle>
                {(analytics.revenueByLane || []).length === 0 && (
                  <div style={{ color: G.muted, fontSize: 13 }}>No lane data.</div>
                )}
                {(analytics.revenueByLane || []).slice(0, 15).map((row: any) => (
                  <div
                    key={row.lane}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      padding: '6px 0',
                      borderTop: `1px solid ${G.border}`,
                    }}
                  >
                    <span>
                      {row.lane} · {row.loads} loads
                    </span>
                    <strong>${Number(row.revenue).toFixed(0)}</strong>
                  </div>
                ))}
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <SectionTitle>Maintenance cost by truck</SectionTitle>
                {(analytics.maintenanceByTruck || []).length === 0 && (
                  <div style={{ color: G.muted, fontSize: 13 }}>No maintenance costs.</div>
                )}
                {(analytics.maintenanceByTruck || []).map((row: any) => (
                  <div
                    key={row.unitNo}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      padding: '6px 0',
                      borderTop: `1px solid ${G.border}`,
                    }}
                  >
                    <span>#{row.unitNo}</span>
                    <strong>${Number(row.cost).toFixed(2)}</strong>
                  </div>
                ))}
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <SectionTitle>Load profitability</SectionTitle>
                {(analytics.loadProfitability || []).slice(0, 20).map((row: any) => (
                  <div
                    key={row.loadId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      padding: '6px 0',
                      borderTop: `1px solid ${G.border}`,
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {row.tripNo || row.loadId.slice(0, 8)} · rev $
                      {Number(row.revenue).toFixed(0)} · cost $
                      {Number(row.cost).toFixed(0)}
                    </span>
                    <strong
                      style={{
                        color:
                          Number(row.margin) >= 0 ? G.success : G.danger,
                      }}
                    >
                      margin ${Number(row.margin).toFixed(0)}
                    </strong>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <SectionTitle>Recent SMS</SectionTitle>
      {smsLog.length === 0 ? (
        <div style={{ color: G.muted, fontSize: 13 }}>No SMS yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {smsLog.map((n) => (
            <div
              key={n.id}
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
                  {n.to}
                </div>
                <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>
                  {n.body}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Pill
                  color={
                    n.status === 'sent' || n.status === 'simulated'
                      ? G.success
                      : n.status === 'failed'
                        ? G.danger
                        : G.info
                  }
                >
                  {n.status}
                </Pill>
                <div style={{ fontSize: 10, color: G.muted, marginTop: 6 }}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
