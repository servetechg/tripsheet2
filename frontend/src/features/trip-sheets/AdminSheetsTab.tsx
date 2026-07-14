import { useMemo, useState } from 'react';
import { G, RADIUS, TYPE } from '@/lib/theme';
import { Btn, Card, Inp, Pill } from '@/components/ui';

export function AdminSheetsTab({ sheets, users, onViewPdf }: any) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...sheets]
      .sort((a, b) => ((b.createdAt || '') >= (a.createdAt || '') ? 1 : -1))
      .filter((s) => {
        if (!q) return true;
        const d = users.find((u: any) => u.id === s.driverId);
        return [s.header?.truckNo, d?.name, s.header?.driver1, s.createdAt]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [sheets, search, users]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const rows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ ...TYPE.sectionTitle, color: G.text }}>Trip Sheets</div>
          <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
            {sorted.length} sheet{sorted.length === 1 ? '' : 's'} submitted by drivers
          </div>
        </div>
        <div style={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
          <Inp
            value={search}
            onChange={(e: any) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search sheets…"
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>

      {sheets.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 56 }} hover={false}>
          <div style={{ fontSize: 36 }}>📋</div>
          <div style={{ color: G.muted, marginTop: 10, fontSize: 14 }}>
            No sheets submitted yet by drivers.
          </div>
        </Card>
      ) : sorted.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }} hover={false}>
          <div style={{ color: G.muted, fontSize: 14 }}>No sheets match your search.</div>
        </Card>
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
                  <th>Expenses</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any) => {
                  const d = users.find((u: any) => u.id === s.driverId);
                  const cad = (s.expenses || [])
                    .filter((e: any) => e.currency === 'CAD')
                    .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0);
                  const usd = (s.expenses || [])
                    .filter((e: any) => e.currency === 'USD')
                    .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>#{s.header?.truckNo || '—'}</td>
                      <td>{d?.name || 'Unknown Driver'}</td>
                      <td style={{ fontSize: 12, color: G.muted }}>
                        {s.header?.startDate} → {s.header?.endDate}
                      </td>
                      <td>{s.trips?.length || 0}</td>
                      <td>
                        {cad > 0 || usd > 0 ? (
                          <span style={{ color: G.success, fontWeight: 600, fontSize: 13 }}>
                            {cad > 0 ? `CAD ${cad.toFixed(2)}` : ''}
                            {cad > 0 && usd > 0 ? ' · ' : ''}
                            {usd > 0 ? `USD ${usd.toFixed(2)}` : ''}
                          </span>
                        ) : (
                          <Pill color={G.muted} small>
                            None
                          </Pill>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: G.muted }}>{s.createdAt}</td>
                      <td>
                        <Btn size="sm" onClick={() => onViewPdf(s)}>
                          View PDF
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
              Page {page + 1} of {pageCount}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ opacity: page === 0 ? 0.5 : 1, borderRadius: RADIUS.md }}
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
    </div>
  );
}
