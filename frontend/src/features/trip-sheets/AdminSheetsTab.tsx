import { G, FONT_MONO, RADIUS } from '@/lib/theme';
import { Btn, Card, StatCard, StatsGrid, Icons } from '@/components/ui';
import { isCompactIdentifier } from '@/lib/format';

import type { Expense, TripLeg, TripSheet } from '@tripsheet/shared';
import type { AdminSheetsTabProps } from '@/features/trip-sheets/types';

export function AdminSheetsTab({
  sheets,
  users,
  company,
  onViewPdf,
}: AdminSheetsTabProps) {
  const sorted = [...sheets].sort((a, b) =>
    (b.createdAt || '') >= (a.createdAt || '') ? 1 : -1,
  );

  const cadTotal = sheets.reduce(
    (sum: number, s: TripSheet) =>
      sum +
      (s.expenses || [])
        .filter((e) => e.currency === 'CAD')
        .reduce(
          (a: number, e: Expense) => a + (parseFloat(String(e.amount)) || 0),
          0,
        ),
    0,
  );
  const usdTotal = sheets.reduce(
    (sum: number, s: TripSheet) =>
      sum +
      (s.expenses || [])
        .filter((e) => e.currency === 'USD')
        .reduce(
          (a: number, e: Expense) => a + (parseFloat(String(e.amount)) || 0),
          0,
        ),
    0,
  );
  const legCount = sheets.reduce(
    (sum: number, s: TripSheet) => sum + (s.trips?.length || 0),
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
        sorted.map((s) => {
          const d = users.find((u) => u.id === s.driverId);
          const cad = (s.expenses || [])
            .filter((e) => e.currency === 'CAD')
            .reduce(
              (a: number, e: Expense) =>
                a + (parseFloat(String(e.amount)) || 0),
              0,
            );
          const usd = (s.expenses || [])
            .filter((e) => e.currency === 'USD')
            .reduce(
              (a: number, e: Expense) =>
                a + (parseFloat(String(e.amount)) || 0),
              0,
            );
          const tripNumbers = (s.trips || [])
            .map((trip: TripLeg) => trip.tripNo)
            .filter(Boolean);
          const compactTripNumbers = tripNumbers.filter((tripNo: string) =>
            isCompactIdentifier(tripNo),
          );
          const unusualTripNumbers = tripNumbers.filter(
            (tripNo: string) => !isCompactIdentifier(tripNo),
          );
          const submittedAt = s.createdAt
            ? new Date(s.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Submission date unavailable';
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
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {Icons.driver({ size: 17, color: G.gold })}
                    <span
                      style={{
                        color: G.text,
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      {d?.name || 'Unknown driver'}
                    </span>
                    {s.header?.truckNo && (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: RADIUS.sm,
                          background: G.goldBg,
                          color: G.gold,
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Truck #{s.header.truckNo}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      color: G.text,
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    {s.header?.startDate || 'Start date unavailable'} →{' '}
                    {s.header?.endDate || 'End date unavailable'}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginTop: 8,
                    }}
                  >
                    {compactTripNumbers.map((tripNo: string) => (
                      <span
                        key={tripNo}
                        style={{
                          padding: '2px 7px',
                          border: `1px solid ${G.border}`,
                          borderRadius: RADIUS.sm,
                          color: G.muted2,
                          fontFamily: FONT_MONO,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        Trip #{tripNo}
                      </span>
                    ))}
                    {tripNumbers.length === 0 && (
                      <span style={{ color: G.muted, fontSize: 10 }}>
                        Trips not numbered
                      </span>
                    )}
                  </div>
                  {unusualTripNumbers.length > 0 && (
                    <div
                      title={unusualTripNumbers.join(', ')}
                      style={{
                        maxWidth: 480,
                        marginTop: 5,
                        color: G.muted,
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Other trip reference: {unusualTripNumbers.join(', ')}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                      gap: 6,
                      maxWidth: 520,
                      marginTop: 12,
                      padding: 7,
                      border: `1px solid ${G.border}`,
                      borderRadius: RADIUS.md,
                      background: G.card2,
                    }}
                  >
                    {[
                      ['Legs', s.trips?.length || 0, G.text],
                      ['Expenses', s.expenses?.length || 0, G.text],
                      ['CAD total', `$${cad.toFixed(2)}`, G.text],
                      ['USD total', `$${usd.toFixed(2)}`, G.text],
                    ].map(([label, value, color]) => (
                      <div key={String(label)} style={{ padding: '4px 7px' }}>
                        <div
                          style={{
                            color: G.muted,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            color: String(color),
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: G.muted }}>
                    Submitted {submittedAt}
                  </div>
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
