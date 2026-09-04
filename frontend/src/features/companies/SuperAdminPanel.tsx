import { useEffect, useState, type ReactNode } from 'react';
import { G, FONT_MONO, RADIUS } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, G2, Icons } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { OkBox } from '@/components/feedback/OkBox';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { ServiceHealthBanner } from '@/components/feedback/ServiceHealthBanner';
import { AppShell } from '@/components/layout/AppShell';
import { companiesApi, authApi, plansApi, tenantsApi } from '@/lib/api';
import { isCompanyOwnerRole } from '@tripsheet/shared';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { TenantOpsDashboard } from './TenantOpsDashboard';

const PLAN_FALLBACK = [
  { code: 'starter', name: 'Starter' },
  { code: 'professional', name: 'Professional' },
  { code: 'enterprise', name: 'Enterprise' },
];

function tenantStatusColor(status?: string) {
  if (status === 'active') return G.success;
  if (status === 'failed') return G.danger;
  return G.gold;
}

function formatTenantStatus(status?: string) {
  return (status || 'pending_provision').replace(/_/g, ' ');
}

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const text = typeof value === 'string' ? value : undefined;
  return (
    <div
      style={{
        background: G.card2,
        borderRadius: RADIUS.md,
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: G.muted,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: G.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: mono ? FONT_MONO : undefined,
        }}
        title={text}
      >
        {value}
      </div>
    </div>
  );
}

export function SuperAdminPanel({
  companies,
  setCompanies,
  users,
  setUsers,
  onLogout,
  themeMode,
  onToggleTheme,
  apiEnabled,
  refreshAll,
  activeTab,
  onTabChange,
}: any) {
  const confirmAction = useConfirm();
  const [tab, setTab] = useState('companies');
  const currentTab = activeTab || tab;
  const changeTab = onTabChange || setTab;
  const [show, setShow] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [f, setF] = useState({
    name: '',
    shortName: '',
    tagline: '',
    address: '',
    planCode: 'starter',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const upd = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!apiEnabled) return;
    void plansApi
      .list()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [apiEnabled]);

  const create = async () => {
    if (blank(f.name) || blank(f.shortName)) {
      setErr('Company name and short name required.');
      return;
    }
    if (blank(f.adminName) || blank(f.adminEmail) || blank(f.adminPassword)) {
      setErr('Admin login details required.');
      return;
    }
    if (
      users.find(
        (u: any) => u.email.toLowerCase() === f.adminEmail.trim().toLowerCase(),
      )
    ) {
      setErr('Admin email already in use.');
      return;
    }

    try {
      if (apiEnabled) {
        const company = (await companiesApi.create({
          name: f.name.trim(),
          shortName: f.shortName.trim().toUpperCase(),
          tagline: f.tagline.trim(),
          address: f.address.trim(),
          planCode: f.planCode || 'starter',
          active: true,
        })) as any;
        await authApi.createUser({
          name: f.adminName.trim(),
          email: f.adminEmail.trim().toLowerCase(),
          password: f.adminPassword.trim(),
          role: 'company_owner',
          companyId: company.id,
        });
        await refreshAll?.('all');
        notify(
          `Company created: ${company.tenantDatabase?.dbName || company.slug} (${company.tenantDatabase?.status || 'pending'})`,
        );
      } else {
        const cid = uid();
        const slug = f.shortName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        setCompanies((p: any[]) => [
          ...p,
          {
            id: cid,
            name: f.name.trim(),
            shortName: f.shortName.trim().toUpperCase(),
            slug,
            tagline: f.tagline.trim(),
            address: f.address.trim(),
            active: true,
            status: 'active',
            plan: { code: f.planCode },
            tenantDatabase: {
              dbName: `fq_tenant_${slug}`,
              status: 'pending_provision',
            },
          },
        ]);
        setUsers((p: any[]) => [
          ...p,
          {
            id: uid(),
            name: f.adminName.trim(),
            role: 'company_owner',
            email: f.adminEmail.trim().toLowerCase(),
            password: f.adminPassword.trim(),
            companyId: cid,
          },
        ]);
      }
      setF({
        name: '',
        shortName: '',
        tagline: '',
        address: '',
        planCode: 'starter',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
      });
      setShow(false);
      setErr('');
      setOk(`✓ "${f.name.trim()}" created — tenant database provisioned (or queued for retry).`);
      setTimeout(() => setOk(''), 5000);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create company');
    }
  };

  const toggleCo = async (id: string) => {
    if (apiEnabled) {
      try {
        await companiesApi.toggleActive(id);
        await refreshAll?.('all');
      } catch (e: any) {
        notify(e?.message || 'Toggle failed', 'error');
      }
      return;
    }
    setCompanies((p: any[]) =>
      p.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    );
  };

  const TABS = [
    { id: 'companies', icon: 'companies', label: 'Companies' },
    { id: 'ops', icon: 'reports', label: 'Tenant ops' },
  ];

  return (
    <AppShell
      logo="TS"
      subtitle="Super Admin"
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={changeTab}
      userName="Super Admin"
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
    >
      <ServiceHealthBanner />
      {ok && <OkBox msg={ok} />}

      {currentTab === 'ops' ? (
        <TenantOpsDashboard apiEnabled={apiEnabled} />
      ) : (
        <>
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
            Companies
          </div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
            Manage tenants, plans, and database routing
          </div>
        </div>
        <Btn
          onClick={() => {
            setShow(true);
            setErr('');
          }}
        >
          + New Company
        </Btn>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ['Total', companies.length],
          ['Active', companies.filter((c: any) => c.active).length],
          [
            'DB ready',
            companies.filter(
              (c: any) => c.tenantDatabase?.status === 'active',
            ).length,
          ],
          [
            'Needs attention',
            companies.filter(
              (c: any) =>
                !c.active ||
                c.tenantDatabase?.status === 'failed' ||
                c.tenantDatabase?.lastError,
            ).length,
          ],
        ].map(([label, value]) => (
          <Card key={String(label)} style={{ marginBottom: 0, padding: '12px 14px' }}>
            <div
              style={{
                fontSize: 10,
                color: G.muted,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
          </Card>
        ))}
      </div>

      {show && (
        <Card style={{ border: `1px solid ${G.gold}33` }}>
          <SectionTitle>Create Company + Admin Account</SectionTitle>
          <Err msg={err} />
          <Divider label="Company Details" />
          <G2 cols={2}>
            <Inp
              label="Company Full Name *"
              value={f.name}
              onChange={(e) => upd('name', e.target.value)}
              placeholder="e.g. Denali Transport Inc."
            />
            <div>
              <Inp
                label="Short Name (on trip sheet) *"
                value={f.shortName}
                onChange={(e) =>
                  upd('shortName', e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="e.g. DTI"
                maxLength={6}
              />
            </div>
          </G2>
          <G2 cols={2}>
            <Inp
              label="Tagline"
              value={f.tagline}
              onChange={(e) => upd('tagline', e.target.value)}
            />
            <Inp
              label="Address"
              value={f.address}
              onChange={(e) => upd('address', e.target.value)}
            />
          </G2>
          <Sel
            label="Subscription plan"
            value={f.planCode}
            onChange={(e) => upd('planCode', e.target.value)}
          >
            {(plans.length
              ? plans
              : [
                  { code: 'starter', name: 'Starter' },
                  { code: 'professional', name: 'Professional' },
                  { code: 'enterprise', name: 'Enterprise' },
                ]
            ).map((p: any) => (
              <option key={p.code} value={p.code}>
                {p.name}
                {p.maxDrivers === -1
                  ? ' (unlimited drivers)'
                  : p.maxDrivers
                    ? ` (max ${p.maxDrivers} drivers)`
                    : ''}
              </option>
            ))}
          </Sel>
          <div style={{ fontSize: 11, color: G.muted, marginBottom: 12 }}>
            Tenant DB name will be{' '}
            <code>
              fq_tenant_
              {(f.shortName || '…').toLowerCase().replace(/[^a-z0-9]/g, '') || '…'}
            </code>{' '}
            (created automatically on save).
          </div>
          <Divider label="Company Admin Login" />
          <G2 cols={3}>
            <Inp
              label="Admin Full Name *"
              value={f.adminName}
              onChange={(e) => upd('adminName', e.target.value)}
            />
            <Inp
              label="Admin Email *"
              value={f.adminEmail}
              onChange={(e) => upd('adminEmail', e.target.value)}
            />
            <Inp
              label="Password *"
              value={f.adminPassword}
              onChange={(e) => upd('adminPassword', e.target.value)}
              type="password"
            />
          </G2>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={() => void create()}>Create Company</Btn>
            <Btn variant="outline" onClick={() => setShow(false)}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      {companies.length === 0 && !show ? (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            {Icons.companies({ size: 40, color: G.muted })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>
            No companies yet
          </div>
          <div style={{ fontSize: 13, color: G.muted, marginTop: 6, marginBottom: 16 }}>
            Create your first tenant to provision a database and admin account.
          </div>
          <Btn
            onClick={() => {
              setShow(true);
              setErr('');
            }}
          >
            + New Company
          </Btn>
        </Card>
      ) : null}

      {companies.map((c: any) => {
        const admin = users.find(
          (u: any) => isCompanyOwnerRole(u.role) && u.companyId === c.id,
        );
        const drivers = users.filter(
          (u: any) => u.role === 'driver' && u.companyId === c.id,
        ).length;
        const planOptions = plans.length ? plans : PLAN_FALLBACK;
        const planName =
          planOptions.find(
            (p: any) => p.code === (c.plan?.code || c.planCode || 'starter'),
          )?.name ||
          c.plan?.code ||
          c.planCode ||
          '—';
        const dbName =
          c.tenantDatabase?.dbName ||
          (c.slug ? `fq_tenant_${c.slug}` : '—');
        const tenantStatus = c.tenantDatabase?.status;
        const needsProvision =
          tenantStatus === 'pending_provision' ||
          tenantStatus === 'failed' ||
          tenantStatus === 'provisioning';

        return (
          <Card key={c.id} style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: RADIUS.lg,
                    background: G.goldBg,
                    border: `1px solid ${G.gold}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: -0.5,
                    color: G.gold,
                  }}
                >
                  {c.shortName}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: G.text,
                          letterSpacing: -0.2,
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: G.muted,
                          marginTop: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {admin ? (
                          <>
                            {admin.name} · {admin.email}
                          </>
                        ) : (
                          <span style={{ color: G.danger }}>No admin assigned</span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Pill color={c.active ? G.success : G.danger}>
                        {c.active ? 'Active' : 'Disabled'}
                      </Pill>
                      {apiEnabled && (
                        <Pill color={tenantStatusColor(tenantStatus)} small>
                          DB {formatTenantStatus(tenantStatus)}
                        </Pill>
                      )}
                      {apiEnabled && c.tenantDatabase?.etlStatus && (
                        <Pill color={G.info} small>
                          ETL {c.tenantDatabase.etlStatus.replace(/_/g, ' ')}
                        </Pill>
                      )}
                      {c.tenantDatabase?.writeFreeze ? (
                        <Pill color={G.warning} small>
                          Frozen
                        </Pill>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <MetaCell label="Admin" value={admin?.name || '—'} />
                    <MetaCell
                      label="Drivers"
                      value={`${drivers} registered`}
                    />
                    <MetaCell label="Plan" value={planName} />
                    <MetaCell label="Slug" value={c.slug || '—'} mono />
                    <MetaCell label="Database" value={dbName} mono />
                    <MetaCell
                      label="Routing"
                      value={c.tenantDatabase?.routingMode || 'shared'}
                    />
                  </div>

                  {c.tenantDatabase?.lastError ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: RADIUS.md,
                        background: G.dangerBg,
                        border: `1px solid ${G.danger}33`,
                        fontSize: 12,
                        color: G.danger,
                        lineHeight: 1.45,
                      }}
                    >
                      {c.tenantDatabase.lastError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 20px 16px',
                borderTop: `1px solid ${G.border}`,
                background: G.card2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  flex: '1 1 260px',
                  minWidth: 0,
                }}
              >
                {apiEnabled && (
                  <div style={{ flex: '1 1 160px', maxWidth: 220, minWidth: 140 }}>
                    <Sel
                      label="Subscription"
                      value={c.plan?.code || 'starter'}
                      onChange={(e) => {
                        const planCode = e.target.value;
                        void companiesApi
                          .changePlan(c.id, planCode)
                          .then((updated: any) => {
                            setCompanies((prev: any[]) =>
                              prev.map((co) =>
                                co.id === c.id
                                  ? {
                                      ...co,
                                      plan: updated.plan,
                                      planId: updated.planId,
                                      subscription: updated.subscription,
                                    }
                                  : co,
                              ),
                            );
                            notify(
                              `Plan updated to ${updated.plan?.name || planCode}`,
                            );
                          })
                          .catch((err: any) =>
                            notify(err?.message || 'Plan change failed', 'error'),
                          );
                      }}
                      style={{ marginBottom: 0, width: '100%' }}
                    >
                      {planOptions.map((p: any) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </Sel>
                  </div>
                )}
                {apiEnabled && tenantStatus === 'active' && (
                  <div style={{ flex: '1 1 160px', maxWidth: 220, minWidth: 140 }}>
                    <Sel
                      label="DB routing"
                      value={c.tenantDatabase?.routingMode || 'shared'}
                      onChange={(e) => {
                        const mode = e.target.value as 'shared' | 'tenant';
                        void tenantsApi
                          .setRoutingMode(c.id, mode)
                          .then(() => {
                            notify(`Routing → ${mode}`);
                            return refreshAll?.('all');
                          })
                          .catch((err: any) =>
                            notify(
                              err?.message || 'Routing mode change failed',
                              'error',
                            ),
                          );
                      }}
                      style={{ marginBottom: 0, width: '100%' }}
                    >
                      <option value="shared">Shared database</option>
                      <option value="tenant">Tenant database</option>
                    </Sel>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flex: '0 1 auto',
                }}
              >
                {apiEnabled && needsProvision && (
                  <Btn
                    size="sm"
                    onClick={() => {
                      void tenantsApi
                        .provision(c.id, true)
                        .then(() => {
                          notify('Tenant DB provisioned');
                          return refreshAll?.('all');
                        })
                        .catch((err: any) =>
                          notify(err?.message || 'Provision failed', 'error'),
                        );
                    }}
                  >
                    {tenantStatus === 'failed' ? 'Retry provision' : 'Provision DB'}
                  </Btn>
                )}
                {apiEnabled &&
                  tenantStatus === 'active' &&
                  c.tenantDatabase?.etlStatus !== 'cutover' &&
                  c.tenantDatabase?.etlStatus !== 'archived' && (
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void tenantsApi
                          .migrate(c.id)
                          .then(() => {
                            notify('ETL migrate + verify complete');
                            return refreshAll?.('all');
                          })
                          .catch((err: any) =>
                            notify(err?.message || 'Migrate failed', 'error'),
                          );
                      }}
                    >
                      Migrate ETL
                    </Btn>
                  )}
                {apiEnabled && c.tenantDatabase?.etlStatus === 'verified' && (
                  <Btn
                    size="sm"
                    onClick={() => {
                      void tenantsApi
                        .cutover(c.id)
                        .then(() => {
                          notify('Cut over to tenant DB');
                          return refreshAll?.('all');
                        })
                        .catch((err: any) =>
                          notify(err?.message || 'Cutover failed', 'error'),
                        );
                    }}
                  >
                    Cut over
                  </Btn>
                )}
                {apiEnabled && c.tenantDatabase?.etlStatus === 'cutover' && (
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      void (async () => {
                        const approved = await confirmAction({
                          title: 'Archive shared data',
                          message:
                            "Delete this company's rows from shared DBs? Tenant DB keeps the data.",
                          confirmLabel: 'Delete shared rows',
                          variant: 'danger',
                        });
                        if (!approved) return;
                        void tenantsApi
                          .archiveShared(c.id)
                          .then(() => {
                            notify('Shared data archived');
                            return refreshAll?.('all');
                          })
                          .catch((err: any) =>
                            notify(err?.message || 'Archive failed', 'error'),
                          );
                      })();
                    }}
                  >
                    Archive shared
                  </Btn>
                )}
                <Btn
                  size="sm"
                  variant={c.active ? 'outline' : 'success'}
                  style={
                    c.active
                      ? { color: G.danger, borderColor: `${G.danger}44` }
                      : undefined
                  }
                  onClick={() => void toggleCo(c.id)}
                >
                  {c.active ? 'Disable company' : 'Enable company'}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}
        </>
      )}
    </AppShell>
  );
}
