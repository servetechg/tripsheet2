import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Pill, SectionTitle } from '@/components/ui';
import { tenantsApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { TenantIssueAlert } from '@/components/feedback/TenantIssueAlert';
import { humanizeEnum } from '@/lib/format';

type OpsSummary = {
  generatedAt: string;
  totals: {
    tenants: number;
    active: number;
    failed: number;
    suspended: number;
    withErrors: number;
    totalSizeBytes: number;
    totalConnections: number;
  };
  tenants: Array<{
    companyId: string;
    name: string;
    shortName: string;
    slug: string;
    dbName: string;
    status: string;
    routingMode: string;
    schemaVersion: string;
    issue?: {
      code: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
      actionable?: boolean;
      technicalDetail?: string;
    } | null;
    sizePretty: string;
    connections: number;
    writeFreeze: boolean;
  }>;
  recentErrors: Array<{
    id: string;
    companyId: string | null;
    action: string;
    actorName: string;
    createdAt: string;
  }>;
};

function formatBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function TenantOpsDashboard({ apiEnabled }: { apiEnabled: boolean }) {
  const [data, setData] = useState<OpsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const load = async () => {
    if (!apiEnabled) return;
    setLoading(true);
    try {
      const s = await tenantsApi.opsSummary();
      setData(s);
    } catch (e: any) {
      notify(e?.message || 'Failed to load tenant ops', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [apiEnabled]);

  const runMigrate = async () => {
    setMigrating(true);
    try {
      const r = await tenantsApi.schemaMigrateAll();
      notify(`Schema migrate: ${r.ok}/${r.migrated} ok`);
      await load();
    } catch (e: any) {
      notify(e?.message || 'Schema migrate failed', 'error');
    } finally {
      setMigrating(false);
    }
  };

  if (!apiEnabled) {
    return (
      <Card>
        <SectionTitle>Tenant ops</SectionTitle>
        <div style={{ color: G.muted, fontSize: 13 }}>
          Enable API mode to view per-tenant disk, connections, and errors.
        </div>
      </Card>
    );
  }

  const t = data?.totals;

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
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: G.text }}>
            Tenant ops
          </div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
            Connections, disk, and registry errors
            {data?.generatedAt
              ? ` · ${new Date(data.generatedAt).toLocaleString()}`
              : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Btn>
          <Btn onClick={() => void runMigrate()} disabled={migrating}>
            {migrating ? 'Migrating…' : 'Schema migrate-all'}
          </Btn>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ['Tenants', t?.tenants ?? '—'],
          ['Active', t?.active ?? '—'],
          ['Failed', t?.failed ?? '—'],
          ['Suspended', t?.suspended ?? '—'],
          ['With errors', t?.withErrors ?? '—'],
          ['Connections', t?.totalConnections ?? '—'],
          ['Disk', t ? formatBytes(t.totalSizeBytes) : '—'],
        ].map(([label, value]) => (
          <Card key={String(label)} style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: G.muted, textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{value}</div>
          </Card>
        ))}
      </div>

      {(data?.tenants || []).map((row) => (
        <Card key={row.companyId} style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>
                {row.name}
              </div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
                {row.shortName} · {row.sizePretty} · {row.connections}{' '}
                {row.connections === 1 ? 'connection' : 'connections'}
              </div>
              <details style={{ fontSize: 11, color: G.muted2, marginTop: 5 }}>
                <summary style={{ cursor: 'pointer', color: G.muted }}>
                  Technical tenant details
                </summary>
                <div style={{ marginTop: 4, fontFamily: 'monospace' }}>
                  Database: {row.dbName} · Schema: v{row.schemaVersion} · Routing:{' '}
                  {humanizeEnum(row.routingMode)}
                  {row.writeFreeze ? ' · Writes frozen' : ''}
                </div>
              </details>
              {row.issue ? (
                <TenantIssueAlert issue={row.issue} style={{ marginTop: 6 }} />
              ) : null}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Pill
                color={
                  row.status === 'active'
                    ? G.success
                    : row.status === 'failed'
                      ? G.danger
                      : G.gold
                }
              >
                {humanizeEnum(row.status)}
              </Pill>
            </div>
          </div>
        </Card>
      ))}

      {data?.recentErrors?.length ? (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle>Recent lifecycle errors</SectionTitle>
          {data.recentErrors.map((e) => {
            const tenant = data.tenants.find((row) => row.companyId === e.companyId);
            return (
              <div
                key={e.id}
                style={{
                  fontSize: 12,
                  padding: '8px 0',
                  borderBottom: `1px solid ${G.border}`,
                }}
              >
                <div style={{ color: G.text, fontWeight: 600 }}>
                  {humanizeEnum(e.action)}{tenant ? ` · ${tenant.name}` : ''}
                </div>
                <div style={{ color: G.muted, marginTop: 2 }}>
                  {e.actorName || 'System'} · {new Date(e.createdAt).toLocaleString()}
                </div>
                <details style={{ color: G.muted2, marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer' }}>Technical details</summary>
                  <div style={{ marginTop: 3, fontFamily: 'monospace' }}>
                    Action: {e.action} · Company ID: {e.companyId || '—'} · Event ID: {e.id}
                  </div>
                </details>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
