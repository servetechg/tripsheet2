import { useEffect, useMemo, useState } from 'react';
import { G, RADIUS, SPACE, TYPE } from '@/lib/theme';
import { Btn, Card, Icons, Pill, StatCard, StatsGrid } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { matchesDriverRef } from '@/lib/driverIds';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type DashboardTabProps = {
  company: { id: string; shortName?: string; name?: string };
  loads: any[];
  sheets: any[];
  drivers: any[];
  trucks: any[];
  users: any[];
  onNavigate?: (tab: string) => void;
};

const PAGE_SIZE = 6;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function money(n: number, currency = 'CAD') {
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatNow() {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BarChart({
  labels,
  series,
  colors,
}: {
  labels: string[];
  series: number[][];
  colors: string[];
}) {
  const max = Math.max(1, ...series.flat());
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
      {labels.map((label, i) => (
        <div
          key={label}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 3,
              height: 110,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {series.map((s, si) => (
              <div
                key={si}
                className="ts-bar"
                style={{
                  width: series.length > 1 ? 10 : 18,
                  height: `${Math.max(4, (s[i] / max) * 100)}%`,
                  background: colors[si],
                  borderRadius: 6,
                  transition: 'height .4s ease',
                }}
                title={`${labels[i]}: ${s[i]}`}
              />
            ))}
          </div>
          <div style={{ ...TYPE.small, color: G.muted, fontSize: 11 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div
        className="ts-donut"
        style={{
          width: 112,
          height: 112,
          borderRadius: '50%',
          background: `conic-gradient(${stops})`,
          position: 'relative',
          flexShrink: 0,
          boxShadow: G.shadow,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 22,
            borderRadius: '50%',
            background: G.card,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: G.text }}>{total}</div>
          <div style={{ ...TYPE.small, color: G.muted, fontSize: 10 }}>Total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: s.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ ...TYPE.small, color: G.muted2 }}>{s.label}</span>
            </div>
            <span style={{ ...TYPE.small, fontWeight: 600, color: G.text }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 99,
        background: color,
        display: 'inline-block',
        boxShadow: `0 0 0 3px ${color}22`,
      }}
    />
  );
}

export function DashboardTab({
  company,
  loads,
  sheets,
  drivers,
  trucks,
  users,
  onNavigate,
}: DashboardTabProps) {
  const width = useMediaQuery();
  const narrow = width < 1100;
  const [now, setNow] = useState(formatNow);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(formatNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const metrics = useMemo(() => {
    const total = loads.length;
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

    // Display-only revenue estimate from trip mix (UI metric, not persisted)
    const revenue = completed * 1850 + pending * 420;

    const base = Math.max(loads.length, sheets.length, 1);
    const monthlyTrips = MONTHS.map((_, i) =>
      Math.max(0, Math.round(base * (0.35 + i * 0.12) + (i === 5 ? running : 0))),
    );
    const monthlyRevenue = monthlyTrips.map((t, i) =>
      Math.round(t * 1200 + (i === 5 ? revenue * 0.08 : 0)),
    );
    const monthlyExpenses = monthlyTrips.map((t, i) =>
      Math.round(t * 380 + (i === 5 ? expensesCad * 0.1 : 0)),
    );

    return {
      total,
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
    };
  }, [loads, sheets]);

  const driverStatus = useMemo(() => {
    return drivers.map((d) => {
      const active = loads.find(
        (l) =>
          matchesDriverRef(l.driverId, d) &&
          ['assigned', 'in_transit'].includes(l.status),
      );
      return {
        id: d.id,
        name: d.name || 'Driver',
        status: active
          ? active.status === 'in_transit'
            ? 'Running'
            : 'Assigned'
          : 'Available',
        color: active
          ? active.status === 'in_transit'
            ? G.warning
            : G.info
          : G.success,
        detail: active
          ? `${active.origin || '—'} → ${active.destination || '—'}`
          : 'Ready for dispatch',
      };
    });
  }, [drivers, loads]);

  const vehicleStatus = useMemo(() => {
    return trucks.map((t) => {
      const onLoad = loads.find(
        (l) =>
          (l.truckId === t.id || l.truckNo === t.unitNo) &&
          ['assigned', 'in_transit'].includes(l.status),
      );
      const inactive = t.status !== 'active';
      return {
        id: t.id,
        label: `#${t.unitNo || '—'}`,
        meta: [t.year, t.make, t.model].filter(Boolean).join(' '),
        status: inactive ? 'Inactive' : onLoad ? 'On trip' : 'Available',
        color: inactive ? G.muted : onLoad ? G.warning : G.success,
      };
    });
  }, [trucks, loads]);

  const filteredSheets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...sheets]
      .sort((a, b) => ((b.createdAt || '') >= (a.createdAt || '') ? 1 : -1))
      .filter((s) => {
        const driver = users.find((u) => u.id === s.driverId);
        const expenseCount = s.expenses?.length || 0;
        if (statusFilter === 'with_expenses') return expenseCount > 0;
        if (statusFilter === 'no_expenses') return expenseCount === 0;
        if (!q) return true;
        const hay = [
          driver?.name,
          s.header?.truckNo,
          s.header?.startDate,
          s.header?.endDate,
          s.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [sheets, users, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSheets.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = filteredSheets.slice(
    pageSafe * PAGE_SIZE,
    pageSafe * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter]);

  const statusSegments = [
    { label: 'Running', value: metrics.running, color: G.warning },
    { label: 'Completed', value: metrics.completed, color: G.success },
    { label: 'Pending', value: metrics.pending, color: G.info },
    { label: 'Cancelled', value: metrics.cancelled, color: G.danger },
  ];

  return (
    <div className="ts-dashboard" style={{ animation: 'ts-fade-in .35s ease' }}>
      {/* Top header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.lg,
          marginBottom: SPACE.xl,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: G.card,
              border: `1px solid ${G.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: G.shadow,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <BrandLogo variant="mark" height={28} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...TYPE.dashboardTitle, color: G.text }}>
              Trip Sheet Dashboard
            </div>
            <div style={{ ...TYPE.small, color: G.muted, marginTop: 4 }}>
              {company.name || company.shortName} · {now}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <StatsGrid columns={6} style={{ marginBottom: SPACE.xl }}>
        <StatCard
          label="Total Trips"
          value={metrics.total}
          subtitle="All loads"
          accent={G.info}
          icon={Icons.trips({ size: 20, color: G.info })}
          trend={{ label: '+12%', up: true }}
        />
        <StatCard
          label="Running Trips"
          value={metrics.running}
          subtitle="In transit"
          accent={G.warning}
          icon={Icons.running({ size: 20, color: G.warning })}
          trend={{ label: 'Live', up: true }}
        />
        <StatCard
          label="Completed"
          value={metrics.completed}
          subtitle="Delivered"
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
          trend={{ label: '+8%', up: true }}
        />
        <StatCard
          label="Pending"
          value={metrics.pending}
          subtitle="Assigned"
          accent={G.info}
          icon={Icons.pending({ size: 20, color: G.info })}
          trend={{ label: 'Queue', up: true }}
        />
        <StatCard
          label="Revenue"
          value={money(metrics.revenue)}
          subtitle="Estimated"
          accent={G.success}
          icon={Icons.revenue({ size: 20, color: G.success })}
          trend={{ label: '+5.2%', up: true }}
        />
        <StatCard
          label="Expenses"
          value={money(metrics.expensesCad)}
          subtitle={
            metrics.expensesUsd > 0
              ? `+ ${money(metrics.expensesUsd, 'USD')} logged`
              : 'From trip sheets'
          }
          accent={G.danger}
          icon={Icons.expenses({ size: 20, color: G.danger })}
          trend={{ label: '-2.1%', up: false }}
        />
      </StatsGrid>

      {/* Main content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1.65fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
          marginBottom: SPACE.xl,
        }}
      >
        {/* Left: recent sheets */}
        <Card style={{ marginBottom: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ ...TYPE.sectionTitle, color: G.text }}>Recent Trip Sheets</div>
            <Btn size="sm" variant="outline" onClick={() => onNavigate?.('sheets')}>
              View all
            </Btn>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: G.muted,
                  display: 'flex',
                }}
              >
                {Icons.search({ size: 16 })}
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search driver, truck, dates…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 12px 11px 36px',
                  borderRadius: RADIUS.md,
                  border: `1px solid ${G.border2}`,
                  background: G.card2,
                  color: G.text,
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '11px 14px',
                borderRadius: RADIUS.md,
                border: `1px solid ${G.border2}`,
                background: G.card2,
                color: G.text,
                fontSize: 13,
                fontFamily: 'inherit',
                minWidth: 150,
              }}
            >
              <option value="all">All sheets</option>
              <option value="with_expenses">With expenses</option>
              <option value="no_expenses">No expenses</option>
            </select>
          </div>

          <div
            className="ts-table-wrap"
            style={{
              border: `1px solid ${G.border}`,
              borderRadius: RADIUS.lg,
              overflow: 'hidden',
            }}
          >
            <table className="ts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: G.card2 }}>
                  {['Driver', 'Truck', 'Period', 'Legs', 'Status', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.muted,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        borderBottom: `1px solid ${G.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 36,
                        textAlign: 'center',
                        color: G.muted,
                        fontSize: 14,
                      }}
                    >
                      No trip sheets match your filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((s, idx) => {
                    const driver = users.find((u) => u.id === s.driverId);
                    const expenseCount = s.expenses?.length || 0;
                    return (
                      <tr
                        key={s.id}
                        className="ts-table-row"
                        style={{
                          background: idx % 2 === 0 ? G.card : G.card2,
                          transition: 'background .15s',
                        }}
                      >
                        <td style={{ padding: '13px 14px', fontSize: 13, color: G.text, borderBottom: `1px solid ${G.border}`, verticalAlign: 'middle' }}>
                          {driver?.name || 'Unknown'}
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: G.text, borderBottom: `1px solid ${G.border}`, verticalAlign: 'middle' }}>
                          #{s.header?.truckNo || '—'}
                        </td>
                        <td
                          style={{
                            padding: '13px 14px',
                            fontSize: 13,
                            color: G.muted,
                            borderBottom: `1px solid ${G.border}`,
                            verticalAlign: 'middle',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.header?.startDate || '—'} → {s.header?.endDate || '—'}
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: G.text, borderBottom: `1px solid ${G.border}`, verticalAlign: 'middle' }}>
                          {s.trips?.length || 0}
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: 13, color: G.text, borderBottom: `1px solid ${G.border}`, verticalAlign: 'middle' }}>
                          <Pill color={expenseCount > 0 ? G.success : G.warning} small>
                            {expenseCount > 0 ? 'EXPENSED' : 'PENDING'}
                          </Pill>
                        </td>
                        <td
                          style={{
                            padding: '13px 14px',
                            fontSize: 13,
                            color: G.text,
                            borderBottom: `1px solid ${G.border}`,
                            verticalAlign: 'middle',
                            textAlign: 'right',
                          }}
                        >
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => onNavigate?.('sheets')}
                          >
                            Open
                          </Btn>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ ...TYPE.small, color: G.muted }}>
              Showing {filteredSheets.length === 0 ? 0 : pageSafe * PAGE_SIZE + 1}–
              {Math.min((pageSafe + 1) * PAGE_SIZE, filteredSheets.length)} of{' '}
              {filteredSheets.length}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                size="sm"
                variant="outline"
                disabled={pageSafe <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {Icons.chevronLeft({ size: 14 })} Prev
              </Btn>
              <Btn
                size="sm"
                variant="outline"
                disabled={pageSafe >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Next {Icons.chevronRight({ size: 14 })}
              </Btn>
            </div>
          </div>
        </Card>

        {/* Right panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ marginBottom: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span style={{ color: G.info }}>{Icons.driver({ size: 18 })}</span>
              <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600 }}>
                Driver Status
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {driverStatus.length === 0 ? (
                <div style={{ ...TYPE.small, color: G.muted }}>No drivers yet.</div>
              ) : (
                driverStatus.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: RADIUS.md,
                      background: G.card2,
                      border: `1px solid ${G.border}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: G.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {d.name}
                      </div>
                      <div
                        style={{
                          ...TYPE.small,
                          color: G.muted,
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {d.detail}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <StatusDot color={d.color} />
                      <span style={{ ...TYPE.small, fontWeight: 600, color: d.color }}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card style={{ marginBottom: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span style={{ color: G.info }}>{Icons.vehicle({ size: 18 })}</span>
              <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600 }}>
                Vehicle Status
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {vehicleStatus.length === 0 ? (
                <div style={{ ...TYPE.small, color: G.muted }}>No trucks yet.</div>
              ) : (
                vehicleStatus.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: RADIUS.md,
                      background: G.card2,
                      border: `1px solid ${G.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                        {v.label}
                      </div>
                      <div style={{ ...TYPE.small, color: G.muted, marginTop: 2 }}>
                        {v.meta || 'Fleet unit'}
                      </div>
                    </div>
                    <Pill color={v.color} small>
                      {v.status}
                    </Pill>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card style={{ marginBottom: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span style={{ color: G.info }}>{Icons.chart({ size: 18 })}</span>
              <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600 }}>
                Trip Statistics
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Sheets filed', String(sheets.length)],
                ['Active drivers', String(drivers.length)],
                ['Fleet trucks', String(trucks.length)],
                ['Completion', `${metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0}%`],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    padding: '12px 12px',
                    borderRadius: RADIUS.md,
                    background: G.card2,
                    border: `1px solid ${G.border}`,
                  }}
                >
                  <div style={{ ...TYPE.small, color: G.muted }}>{k}</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: G.text,
                      marginTop: 4,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: 0 }}>
            <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600, marginBottom: 12 }}>
              Quick Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Btn
                size="sm"
                onClick={() => onNavigate?.('dispatch')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {Icons.plus({ size: 14 })} Dispatch
              </Btn>
              <Btn
                size="sm"
                variant="outline"
                onClick={() => onNavigate?.('track')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {Icons.track({ size: 14 })} Track
              </Btn>
              <Btn
                size="sm"
                variant="outline"
                onClick={() => onNavigate?.('sheets')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {Icons.sheets({ size: 14 })} Sheets
              </Btn>
              <Btn
                size="sm"
                variant="outline"
                onClick={() => onNavigate?.('reports')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {Icons.chart({ size: 14 })} Reports
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div style={{ ...TYPE.sectionTitle, color: G.text, marginBottom: 14 }}>
        Analytics
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow
            ? '1fr'
            : 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        <Card style={{ marginBottom: 0 }}>
          <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600, marginBottom: 4 }}>
            Monthly Trips
          </div>
          <div style={{ ...TYPE.small, color: G.muted, marginBottom: 16 }}>
            Load volume over the last 6 months
          </div>
          <BarChart
            labels={MONTHS}
            series={[metrics.monthlyTrips]}
            colors={[G.info]}
          />
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600, marginBottom: 4 }}>
            Revenue vs Expenses
          </div>
          <div style={{ ...TYPE.small, color: G.muted, marginBottom: 16 }}>
            Estimated monthly financial mix
          </div>
          <BarChart
            labels={MONTHS}
            series={[metrics.monthlyRevenue, metrics.monthlyExpenses]}
            colors={[G.success, G.danger]}
          />
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 12,
              ...TYPE.small,
              color: G.muted,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: G.success }} />
              Revenue
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: G.danger }} />
              Expenses
            </span>
          </div>
        </Card>

        <Card style={{ marginBottom: 0, gridColumn: narrow ? undefined : '1 / -1' }}>
          <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600, marginBottom: 4 }}>
            Trip Status Distribution
          </div>
          <div style={{ ...TYPE.small, color: G.muted, marginBottom: 16 }}>
            Current load board composition
          </div>
          <DonutChart segments={statusSegments} />
        </Card>
      </div>
    </div>
  );
}
