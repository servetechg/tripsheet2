import { useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Pill, Divider, SectionTitle, G2 } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { OkBox } from '@/components/feedback/OkBox';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { AppShell } from '@/components/layout/AppShell';
import { companiesApi, authApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

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
}: any) {
  const [tab, setTab] = useState('companies');
  const [show, setShow] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    name: '',
    shortName: '',
    tagline: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const upd = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

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
          active: true,
        })) as any;
        await authApi.createUser({
          name: f.adminName.trim(),
          email: f.adminEmail.trim().toLowerCase(),
          password: f.adminPassword.trim(),
          role: 'company_admin',
          companyId: company.id,
        });
        await refreshAll?.('all');
      } else {
        const cid = uid();
        setCompanies((p: any[]) => [
          ...p,
          {
            id: cid,
            name: f.name.trim(),
            shortName: f.shortName.trim().toUpperCase(),
            tagline: f.tagline.trim(),
            address: f.address.trim(),
            active: true,
          },
        ]);
        setUsers((p: any[]) => [
          ...p,
          {
            id: uid(),
            name: f.adminName.trim(),
            role: 'company_admin',
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
        adminName: '',
        adminEmail: '',
        adminPassword: '',
      });
      setShow(false);
      setErr('');
      setOk(`✓ "${f.name.trim()}" created successfully.`);
      setTimeout(() => setOk(''), 4000);
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

  const TABS = [{ id: 'companies', icon: '🏢', label: 'Companies' }];

  return (
    <AppShell
      logo="TS"
      subtitle="Super Admin"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
      topRight={
        <Btn variant="outline" size="sm" onClick={onLogout}>
          LOGOUT
        </Btn>
      }
    >
      {ok && <OkBox msg={ok} />}

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
            {apiEnabled ? ' · live' : ' · demo'}
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
              onChange={(e) => upd('tagline', e.target.value)}
            />
            <Inp
              label="Address"
              value={f.address}
              onChange={(e) => upd('address', e.target.value)}
            />
          </G2>
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

      {companies.map((c: any) => {
        const admin = users.find(
          (u: any) => u.role === 'company_admin' && u.companyId === c.id,
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
    </AppShell>
  );
}
