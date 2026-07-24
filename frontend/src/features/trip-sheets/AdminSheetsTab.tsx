import { G } from '@/lib/theme';
import { Btn, Card, StatCard, StatsGrid, Icons } from '@/components/ui';

export function AdminSheetsTab({ sheets, users, company, onViewPdf }: any) {
  const sorted = [...sheets].sort((a: any, b: any) =>
    (b.createdAt || '') >= (a.createdAt || '') ? 1 : -1,
  );

  const cadTotal = sheets.reduce(
    (sum: number, s: any) =>
      sum +
      (s.expenses || [])
        .filter((e: any) => e.currency === 'CAD')
        .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0),
    0,
  );
  const usdTotal = sheets.reduce(
    (sum: number, s: any) =>
      sum +
      (s.expenses || [])
        .filter((e: any) => e.currency === 'USD')
        .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0),
    0,
  );
  const legCount = sheets.reduce(
    (sum: number, s: any) => sum + (s.trips?.length || 0),
    0,
  );

  return (
    <div>
      <StatsGrid>
        <StatCard
          label="Trip Sheets"
          value={sheets.length}
          subtitle="Submitted by drivers"
          accent={G.info}
          icon={Icons.sheets({ size: 20, color: G.info })}
        />
        <StatCard
          label="Trip Legs"
          value={legCount}
          subtitle="Across all sheets"
          accent={G.warning}
          icon={Icons.trips({ size: 20, color: G.warning })}
        />
        <StatCard
          label="CAD Expenses"
          value={`$${cadTotal.toFixed(0)}`}
          subtitle="Logged amounts"
          accent={G.success}
          icon={Icons.expenses({ size: 20, color: G.success })}
        />
        <StatCard
          label="USD Expenses"
          value={`$${usdTotal.toFixed(0)}`}
          subtitle="Logged amounts"
          accent={G.purple}
          icon={Icons.revenue({ size: 20, color: G.purple })}
        />
      </StatsGrid>

      {sheets.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div>{Icons.sheets({ size: 36, color: G.muted })}</div>
          <div style={{ color: G.muted, marginTop: 10 }}>
            No sheets submitted yet by drivers.
          </div>
        </Card>
      ) : (
        sorted.map((s: any) => {
          const d = users.find((u: any) => u.id === s.driverId);
          const cad = (s.expenses || [])
            .filter((e: any) => e.currency === 'CAD')
            .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0);
          const usd = (s.expenses || [])
            .filter((e: any) => e.currency === 'USD')
            .reduce((a: number, e: any) => a + (parseFloat(e.amount) || 0), 0);
          return (
            <Card key={s.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Truck #{s.header?.truckNo || '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: G.gold,
                      marginTop: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.driver({ size: 14, color: G.gold })}
                    {d?.name || 'Unknown Driver'}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    {s.header?.startDate} → {s.header?.endDate}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    {s.trips?.length || 0} leg(s) · {s.expenses?.length || 0}{' '}
                    expense(s)
                  </div>
                  {(cad > 0 || usd > 0) && (
                    <div
                      style={{ fontSize: 11, color: G.success, marginTop: 3 }}
                    >
                      {cad > 0 ? `CAD ${cad.toFixed(2)}` : ''}
                      {cad > 0 && usd > 0 ? ' · ' : ''}
                      {usd > 0 ? `USD ${usd.toFixed(2)}` : ''}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: G.gold }}>{s.createdAt}</div>
                  <Btn size="sm" variant="outline" onClick={() => onViewPdf?.(s)}>
                    View PDF
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
