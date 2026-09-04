import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, G2 } from '@/components/ui';
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
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: G.text }}>
            Companies
          </div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
            {companies.length} registered
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
              type="text"
              placeholder="e.g. Moving freight, building trust"
              onChange={(e) => upd('tagline', e.target.value)}
            />
            <Inp
              label="Address"
              value={f.address}
              type="text"
              placeholder="e.g. 100 Carrier Blvd, Toronto, ON"
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
              type="text"
              placeholder="e.g. John Smith"
              onChange={(e) => upd('adminName', e.target.value)}
            />
            <Inp
              label="Admin Email *"
              value={f.adminEmail}
              type="email"
              placeholder="e.g. admin@company.com"
              onChange={(e) => upd('adminEmail', e.target.value)}
            />
            <Inp
              label="Password *"
              value={f.adminPassword}
              type="password"
              placeholder="Min. 6 characters"
              onChange={(e) => upd('adminPassword', e.target.value)}
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

      {companies.map((c: any) => {
        const admin = users.find(
          (u: any) => isCompanyOwnerRole(u.role) && u.companyId === c.id,
        );
        const drivers = users.filter(
          (u: any) => u.role === 'driver' && u.companyId === c.id,
        ).length;
        return (
          <Card key={c.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>
                  {c.shortName.slice(0, -1)}
                  <span style={{ color: G.gold }}>{c.shortName.slice(-1)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>
                  {admin ? (
                    <>
                      Admin: {admin.name} · {admin.email}
                    </>
                  ) : (
                    <span style={{ color: G.danger }}>No admin assigned</span>
                  )}
                  {' · '}
                  {drivers} driver(s)
                </div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>
                  slug: <code>{c.slug || '—'}</code>
                  {' · '}
                  plan: {c.plan?.code || c.planCode || '—'}
                  {' · '}
                  DB:{' '}
                  <code>
                    {c.tenantDatabase?.dbName ||
                      (c.slug ? `fq_tenant_${c.slug}` : '—')}
                  </code>
                  {' · '}
                  route:{' '}
                  <code>{c.tenantDatabase?.routingMode || 'shared'}</code>
                  {' · '}
                  etl:{' '}
                  <code>{c.tenantDatabase?.etlStatus || 'pending'}</code>
                  {c.tenantDatabase?.writeFreeze ? (
                    <>
                      {' · '}
                      <span style={{ color: G.gold }}>frozen</span>
                    </>
                  ) : null}
                  {' · '}
                  <Pill
                    color={
                      c.tenantDatabase?.status === 'active'
                        ? G.success
                        : c.tenantDatabase?.status === 'failed'
                          ? G.danger
                          : G.gold
                    }
                    small
                  >
                    {(c.tenantDatabase?.status || 'pending_provision').replace(
                      /_/g,
                      ' ',
                    )}
                  </Pill>
                  {c.tenantDatabase?.lastError ? (
                    <div
                      style={{
                        fontSize: 10,
                        color: G.danger,
                        marginTop: 4,
                        maxWidth: 420,
                      }}
                    >
                      {c.tenantDatabase.lastError}
                    </div>
                  ) : null}
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
                <Pill color={c.active ? G.success : G.danger}>
                  {c.active ? 'ACTIVE' : 'DISABLED'}
                </Pill>
                {apiEnabled && (
                  <Sel
                    label=""
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
                          notify(`Plan updated to ${updated.plan?.name || planCode}`);
                        })
                        .catch((err: any) =>
                          notify(err?.message || 'Plan change failed', 'error'),
                        );
                    }}
                    style={{ marginBottom: 0, minWidth: 140 }}
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
                      </option>
                    ))}
                  </Sel>
                )}
                {apiEnabled && c.tenantDatabase?.status === 'active' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.tenantDatabase?.etlStatus !== 'cutover' &&
                      c.tenantDatabase?.etlStatus !== 'archived' && (
                        <Btn
                          size="sm"
                          onClick={() => {
                            void tenantsApi
                              .migrate(c.id)
                              .then(() => {
                                notify('ETL migrate + verify complete');
                                return refreshAll?.('all');
                              })
                              .catch((err: any) =>
                                notify(
                                  err?.message || 'Migrate failed',
                                  'error',
                                ),
                              );
                          }}
                        >
                          Migrate ETL
                        </Btn>
                      )}
                    {c.tenantDatabase?.etlStatus === 'verified' && (
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
                    {c.tenantDatabase?.etlStatus === 'cutover' && (
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
                                notify(
                                  err?.message || 'Archive failed',
                                  'error',
                                ),
                              );
                          })();
                        }}
                      >
                        Archive shared
                      </Btn>
                    )}
                  </div>
                )}
                {apiEnabled && c.tenantDatabase?.status === 'active' && (
                  <Sel
                    label=""
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
                    style={{ marginBottom: 0, minWidth: 140 }}
                  >
                    <option value="shared">DB: shared</option>
                    <option value="tenant">DB: tenant</option>
                  </Sel>
                )}
                {apiEnabled &&
                  (c.tenantDatabase?.status === 'pending_provision' ||
                    c.tenantDatabase?.status === 'failed' ||
                    c.tenantDatabase?.status === 'provisioning') && (
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
                            notify(
                              err?.message || 'Provision failed',
                              'error',
                            ),
                          );
                      }}
                    >
                      {c.tenantDatabase?.status === 'failed'
                        ? 'Retry provision'
                        : 'Provision DB'}
                    </Btn>
                  )}
                <Btn
                  variant={c.active ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => void toggleCo(c.id)}
                >
                  {c.active ? 'Disable' : 'Enable'}
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
