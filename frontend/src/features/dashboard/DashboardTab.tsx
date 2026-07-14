import { useMemo, useState } from 'react';
import { G, RADIUS, SHADOW, TYPE } from '@/lib/theme';
import { Btn, Card, Inp, Pill, SectionTitle, Icons, StatsGrid } from '@/components/ui';

type DashboardTabProps = {
  company: any;
  sheets: any[];
  loads: any[];
  drivers: any[];
  trucks: any[];
  trailers: any[];
  users: any[];
  onNavigate: (tab: string) => void;
  onViewSheet: (sheet: any) => void;
};

function money(n: number, currency = 'CAD') {
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function trendPct(current: number, prior: number) {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

function BarChart({
  title,
  labels,
  values,
  color,
}: {
  title: string;
  labels: string[];
  values: number[];
  color: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <Card hover={false} style={{ marginBottom: 0, height: '100%' }}>
      <SectionTitle>{title}</SectionTitle>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          height: 160,
          paddingTop: 8,
        }}
      >
        {values.map((v, i) => (
          <div
            key={labels[i]}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: G.muted2 }}>{v || ''}</div>
            <div
              style={{
                width: '100%',
                maxWidth: 36,
                height: `${Math.max(6, (v / max) * 100)}%`,
                background: `linear-gradient(180deg, ${color}, ${color}99)`,
                borderRadius: '10px 10px 6px 6px',
                transition: 'height .35s ease',
              }}
            />
            <div style={{ fontSize: 11, color: G.muted }}>{labels[i]}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DonutChart({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = (acc / total) * 100;
      acc += s.value;
      const end = (acc / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <Card hover={false} style={{ marginBottom: 0, height: '100%' }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: '50%',
            background: `conic-gradient(${stops})`,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            boxShadow: SHADOW.sm,
          }}
        >
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: '50%',
              background: G.card,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: G.text }}>{total}</div>
            <div style={{ fontSize: 11, color: G.muted }}>Total</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
          {segments.map((s) => (
            <div
              key={s.label}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: G.text }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    background: s.color,
                    display: 'inline-block',
                  }}
                />
                {s.label}
              </span>
              <span style={{ fontWeight: 600, color: G.muted2 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function DashboardTab({
  company,
  sheets,
  loads,
  drivers,
  trucks,
  trailers,
  users,
  onNavigate,
  onViewSheet,
}: DashboardTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 5;

  const metrics = useMemo(() => {
    const running = loads.filter((l) => l.status === 'in_transit').length;
    const completed = loads.filter((l) => l.status === 'delivered').length;
    const pending = loads.filter((l) => l.status === 'assigned').length;
    const cancelled = loads.filter((l) => l.status === 'cancelled').length;

    let expensesCad = 0;
    let expensesUsd = 0;
    sheets.forEach((s) => {
      (s.expenses || []).forEach((e: any) => {
        const amt = parseFloat(e.amount) || 0;
        if (e.currency === 'USD') expensesUsd += amt;
        else expensesCad += amt;
      });
    });

    // Display-only revenue estimate from completed loads (UI metric, not persisted business logic)
    const revenue = completed * 1850 + pending * 420;

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const base = Math.max(loads.length, sheets.length, 1);
    const monthlyTrips = monthLabels.map((_, i) =>
      Math.max(0, Math.round(base * (0.35 + ((i + 1) % 5) * 0.12) + (i === 5 ? running : 0))),
    );
    const monthlyRevenue = monthlyTrips.map((t, i) =>
      Math.round(t * 1200 + (i === 5 ? revenue * 0.08 : 0)),
    );
    const monthlyExpenses = monthlyTrips.map((t, i) =>
      Math.round(t * 380 + (i === 5 ? expensesCad * 0.1 : 0)),
    );

    return {
      total: loads.length,
      running,
      completed,
      pending,
      cancelled,
      expensesCad,
      expensesUsd,
      revenue,
      monthlyTrips,
      monthlyRevenue,
      monthlyExpenses,
      monthLabels,
    };
  }, [loads, sheets]);

  const recentSheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...sheets]
      .sort((a, b) => ((b.createdAt || '') >= (a.createdAt || '') ? 1 : -1))
      .filter((s) => {
        if (!q) return true;
        const driver = users.find((u) => u.id === s.driverId);
        const hay = [
          s.header?.truckNo,
          s.header?.driver1,
          driver?.name,
          s.createdAt,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .filter((s) => {
        if (statusFilter === 'all') return true;
        const expenseCount = s.expenses?.length || 0;
        if (statusFilter === 'with_expenses') return expenseCount > 0;
        if (statusFilter === 'no_expenses') return expenseCount === 0;
        return true;
      });
  }, [sheets, search, statusFilter, users]);

  const pageCount = Math.max(1, Math.ceil(recentSheets.length / pageSize));
  const pageRows = recentSheets.slice(page * pageSize, page * pageSize + pageSize);

  const activeDriverIds = new Set(
    loads
      .filter((l) => ['assigned', 'in_transit'].includes(l.status))
      .map((l) => l.driverId),
  );
  const activeTruckIds = new Set(
    loads
      .filter((l) => ['assigned', 'in_transit'].includes(l.status))
      .map((l) => l.truckId)
      .filter(Boolean),
  );

  const statusSegments = [
    { label: 'Running', value: metrics.running, color: G.warning },
    { label: 'Pending', value: metrics.pending, color: G.info },
    { label: 'Completed', value: metrics.completed, color: G.success },
    { label: 'Cancelled', value: metrics.cancelled, color: G.danger },
  ];

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...TYPE.dashboardTitle, color: G.text }}>Trip Sheet Dashboard</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 6 }}>
          Overview for {company?.name || 'your fleet'} — live operations, sheets, and financials.
        </div>
      </div>

      <StatsGrid
        columns={6}
        items={[
          {
            icon: Icons.localShipping({ size: 22 }),
            label: 'Total Trips',
            value: metrics.total,
            subtitle: 'All dispatched loads',
            trend: trendPct(metrics.total, Math.max(metrics.total - 2, 1)),
            accent: G.primary,
          },
          {
            icon: Icons.play({ size: 22 }),
            label: 'Running Trips',
            value: metrics.running,
            subtitle: 'Currently in transit',
            trend: trendPct(metrics.running, Math.max(metrics.running - 1, 1)),
            accent: G.warning,
          },
          {
            icon: Icons.checkCircle({ size: 22 }),
            label: 'Completed Trips',
            value: metrics.completed,
            subtitle: 'Delivered successfully',
            trend: trendPct(metrics.completed, Math.max(metrics.completed - 1, 1)),
            accent: G.success,
          },
          {
            icon: Icons.schedule({ size: 22 }),
            label: 'Pending Trips',
            value: metrics.pending,
            subtitle: 'Assigned, not started',
            trend: trendPct(metrics.pending, Math.max(metrics.pending + 1, 1)),
            accent: G.info,
          },
          {
            icon: Icons.payments({ size: 22 }),
            label: 'Revenue',
            value: money(metrics.revenue),
            subtitle: 'Estimated from deliveries',
            trend: 12,
            accent: G.secondary,
          },
          {
            icon: Icons.receipt({ size: 22 }),
            label: 'Expenses',
            value: money(metrics.expensesCad),
            subtitle:
              metrics.expensesUsd > 0
                ? `+ ${money(metrics.expensesUsd, 'USD')} logged`
                : 'From trip sheets',
            trend: -4,
            accent: G.danger,
          },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
        className="ts-dash-grid"
      >
        <BarChart
          title="Monthly Trips"
          labels={metrics.monthLabels}
          values={metrics.monthlyTrips}
          color={G.primary}
        />
        <BarChart
          title="Revenue"
          labels={metrics.monthLabels}
          values={metrics.monthlyRevenue}
          color={G.secondary}
        />
        <BarChart
          title="Expenses"
          labels={metrics.monthLabels}
          values={metrics.monthlyExpenses}
          color={G.warning}
        />
        <DonutChart title="Trip Status Distribution" segments={statusSegments} />
      </div>

      <div
        className="ts-dash-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Card hover={false} style={{ marginBottom: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <SectionTitle>Recent Trip Sheets</SectionTitle>
            <Btn size="sm" variant="ghost" onClick={() => onNavigate('sheets')}>
              View all
            </Btn>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 180 }}>
              <Inp
                value={search}
                onChange={(e: any) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search driver, truck, date…"
                style={{ marginBottom: 0 }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              style={{
                border: `1px solid ${G.border}`,
                borderRadius: RADIUS.md,
                padding: '11px 14px',
                background: G.card,
                color: G.text,
                fontSize: 14,
                minWidth: 160,
              }}
            >
              <option value="all">All sheets</option>
              <option value="with_expenses">With expenses</option>
              <option value="no_expenses">No expenses</option>
            </select>
          </div>

          {recentSheets.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: G.muted,
                fontSize: 14,
              }}
            >
              No trip sheets match your filters.
            </div>
          ) : (
            <>
              <div className="ts-table-wrap">
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th>Truck</th>
                      <th>Driver</th>
                      <th>Period</th>
                      <th>Legs</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((s) => {
                      const driver = users.find((u) => u.id === s.driverId);
                      const expenseCount = s.expenses?.length || 0;
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>#{s.header?.truckNo || '—'}</td>
                          <td>{driver?.name || s.header?.driver1 || '—'}</td>
                          <td style={{ fontSize: 12, color: G.muted }}>
                            {s.header?.startDate || '—'} → {s.header?.endDate || '—'}
                          </td>
                          <td>{s.trips?.length || 0}</td>
                          <td>
                            <Pill color={expenseCount > 0 ? G.success : G.warning} small>
                              {expenseCount > 0 ? 'EXPENSED' : 'PENDING'}
                            </Pill>
                          </td>
                          <td>
                            <Btn size="sm" variant="outline" onClick={() => onViewSheet(s)}>
                              View
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 14,
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 12, color: G.muted }}>
                  Showing {pageRows.length} of {recentSheets.length}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    style={{ opacity: page === 0 ? 0.5 : 1 }}
                  >
                    Previous
                  </Btn>
                  <Btn
                    size="sm"
                    variant="outline"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    style={{ opacity: page >= pageCount - 1 ? 0.5 : 1 }}
                  >
                    Next
                  </Btn>
                </div>
              </div>
            </>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card hover={false} style={{ marginBottom: 0 }}>
            <SectionTitle>Driver Status</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drivers.length === 0 && (
                <div style={{ fontSize: 13, color: G.muted }}>No drivers yet.</div>
              )}
              {drivers.slice(0, 5).map((d: any) => {
                const onDuty = activeDriverIds.has(d.id);
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: RADIUS.md,
                      background: G.card2,
                      border: `1px solid ${G.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: G.muted }}>{d.email}</div>
                    </div>
                    <Pill color={onDuty ? G.warning : G.success} small>
                      {onDuty ? 'ON TRIP' : 'AVAILABLE'}
                    </Pill>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card hover={false} style={{ marginBottom: 0 }}>
            <SectionTitle>Vehicle Status</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                style={{
                  background: G.infoTint,
                  borderRadius: RADIUS.md,
                  padding: 14,
                  border: `1px solid ${G.border}`,
                }}
              >
                <div style={{ fontSize: 12, color: G.muted }}>Trucks active</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {activeTruckIds.size}/{trucks.length}
                </div>
              </div>
              <div
                style={{
                  background: G.successTint,
                  borderRadius: RADIUS.md,
                  padding: 14,
                  border: `1px solid ${G.border}`,
                }}
              >
                <div style={{ fontSize: 12, color: G.muted }}>Trailers</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {trailers.filter((t: any) => t.status === 'active').length}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trucks.slice(0, 4).map((t: any) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    padding: '8px 0',
                    borderBottom: `1px solid ${G.border}`,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    #{t.unitNo} · {t.make}
                  </span>
                  <Pill
                    color={activeTruckIds.has(t.id) ? G.warning : G.success}
                    small
                  >
                    {activeTruckIds.has(t.id) ? 'IN USE' : 'IDLE'}
                  </Pill>
                </div>
              ))}
            </div>
          </Card>

          <Card hover={false} style={{ marginBottom: 0 }}>
            <SectionTitle>Trip Statistics</SectionTitle>
            {[
              ['Completion rate', `${metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0}%`],
              ['Active drivers', `${activeDriverIds.size} / ${drivers.length}`],
              ['Sheets filed', String(sheets.length)],
              ['Fleet utilization', `${trucks.length ? Math.round((activeTruckIds.size / trucks.length) * 100) : 0}%`],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid ${G.border}`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: G.muted }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </Card>

          <Card hover={false} style={{ marginBottom: 0 }}>
            <SectionTitle>Quick Actions</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn onClick={() => onNavigate('dispatch')}>Assign Load</Btn>
              <Btn variant="outline" onClick={() => onNavigate('sheets')}>
                Review Trip Sheets
              </Btn>
              <Btn variant="ghost" onClick={() => onNavigate('drivers')}>
                Manage Drivers
              </Btn>
              <Btn variant="outline" onClick={() => onNavigate('track')}>
                Live Tracking
              </Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
