import { useEffect, useState, type ReactNode } from 'react';
import { G, pageCentered, applyTheme, type ThemeMode } from '@/lib/theme';
import { Btn } from '@/components/ui';
import { ToastHost } from '@/components/feedback/Toast';
import { useAppData, type AppUser, setToken } from '@/context/AppDataContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SuperAdminPanel } from '@/features/companies/SuperAdminPanel';
import { CompanyAdminPanel } from '@/features/admin/CompanyAdminPanel';
import { DriverDashboard } from '@/features/drivers/DriverDashboard';
import { DriverOnboarding } from '@/features/invites/DriverOnboarding';
import { invitesApi, authApi, companiesApi } from '@/lib/api';

/** Role / invite session switcher — live API required (Phase 2). */
export function AppRoutes() {
  const data = useAppData();
  const [session, setSession] = useState<AppUser | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [inviteState, setInviteState] = useState<{
    loading: boolean;
    invite: any | null;
    company: any | null;
    error: boolean;
  }>({ loading: false, invite: null, company: null, error: false });

  applyTheme(themeMode);
  const toggleTheme = () => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  const logout = () => {
    setToken(null);
    setSession(null);
  };

  useEffect(() => {
    if (document.getElementById('ts-font-link')) return;
    const link = document.createElement('link');
    link.id = 'ts-font-link';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);

  const inviteToken = new URLSearchParams(window.location.search).get('invite');

  useEffect(() => {
    if (!inviteToken) return;
    if (!data.apiEnabled) {
      setInviteState({ loading: false, invite: null, company: null, error: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setInviteState((s) => ({ ...s, loading: true }));
      try {
        const inv = await invitesApi.byToken(inviteToken);
        const co = await companiesApi.get(inv.companyId);
        if (!cancelled) {
          setInviteState({ loading: false, invite: inv, company: co, error: false });
        }
      } catch {
        if (!cancelled) {
          setInviteState({ loading: false, invite: null, company: null, error: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, data.apiEnabled]);

  useEffect(() => {
    if (session?.companyId) {
      void data.refreshAll(session.companyId);
    } else if (session?.role === 'superadmin') {
      void data.refreshAll('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.companyId, session?.role]);

  const handleLogin = (user: AppUser) => {
    setSession(user);
  };

  let screen: ReactNode;

  if (inviteToken) {
    if (data.loading || inviteState.loading) {
      screen = (
        <div style={{ ...pageCentered() }}>
          <div style={{ color: G.muted }}>Loading invite…</div>
        </div>
      );
    } else if (!data.apiEnabled) {
      screen = (
        <div style={{ ...pageCentered() }}>
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.danger}44`,
              borderRadius: 16,
              padding: 40,
              maxWidth: 400,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⛔</div>
            <div style={{ fontSize: 14, color: G.muted, marginBottom: 12 }}>
              {data.apiError || 'API is offline — invite onboarding requires the live gateway.'}
            </div>
            <Btn size="sm" onClick={() => void data.refreshAll()}>
              Retry
            </Btn>
          </div>
        </div>
      );
    } else if (inviteState.invite && inviteState.company) {
      const invite = inviteState.invite;
      const company = inviteState.company;
      screen = (
        <DriverOnboarding
          invite={invite}
          company={company}
          onComplete={async (profile: any, docs: any, contract: any) => {
            try {
              await authApi.createUser({
                email: profile.email,
                password: profile.password,
                name: profile.name,
                role: 'driver',
                companyId: invite.companyId,
              });
            } catch {
              // user may already exist
            }
            await invitesApi.complete(inviteToken, { profile, docs, contract });
            window.history.replaceState({}, '', window.location.pathname);
            setSession(null);
          }}
        />
      );
    } else {
      screen = (
        <div style={{ ...pageCentered() }}>
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.danger}44`,
              borderRadius: 16,
              padding: 40,
              maxWidth: 360,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⛔</div>
            <div style={{ fontSize: 14, color: G.muted, marginBottom: 8 }}>
              This invite link is invalid or has already been used.
            </div>
            <div style={{ fontSize: 11, color: G.muted }}>
              Contact your employer for a new link.
            </div>
          </div>
        </div>
      );
    }
  } else if (!session) {
    screen = (
      <LoginScreen
        onLogin={handleLogin}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        apiEnabled={data.apiEnabled}
        apiError={data.apiError}
        onRetryApi={() => void data.refreshAll()}
      />
    );
  } else if (session.role === 'superadmin') {
    screen = (
      <SuperAdminPanel
        companies={data.companies}
        setCompanies={data.setCompanies}
        users={data.users}
        setUsers={data.setUsers}
        onLogout={logout}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        apiEnabled={data.apiEnabled}
        refreshAll={data.refreshAll}
      />
    );
  } else {
    const freshSession = data.users.find((u) => u.id === session.id) || session;
    const company = data.companies.find((c) => c.id === freshSession.companyId);

    if (!company || !company.active) {
      screen = (
        <div style={{ ...pageCentered() }}>
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.border}`,
              borderRadius: 18,
              padding: 40,
              maxWidth: 340,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⛔</div>
            <div style={{ color: G.muted, marginBottom: 20 }}>
              Company inactive or not assigned. Contact your administrator.
            </div>
            <Btn full onClick={logout} style={{ padding: 15, fontSize: 14 }}>
              BACK TO LOGIN
            </Btn>
          </div>
        </div>
      );
    } else if (freshSession.role === 'company_admin') {
      screen = (
        <CompanyAdminPanel
          company={company}
          adminUser={freshSession}
          users={data.users}
          setUsers={data.setUsers}
          sheets={data.sheets}
          loads={data.loads}
          setLoads={data.setLoads}
          assets={data.assets}
          setAssets={data.setAssets}
          manifests={data.manifests}
          setManifests={data.setManifests}
          carrierProfiles={data.carrierProfiles}
          setCarrierProfiles={data.setCarrierProfiles}
          driverDocs={data.driverDocs}
          setDriverDocs={data.setDriverDocs}
          invites={data.invites}
          setInvites={data.setInvites}
          onLogout={logout}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          apiEnabled={data.apiEnabled}
          refreshAll={() => data.refreshAll(company.id)}
        />
      );
    } else {
      screen = (
        <DriverDashboard
          user={freshSession}
          company={company}
          sheets={data.sheets}
          setSheets={data.setSheets}
          loads={data.loads}
          driverDocs={data.driverDocs}
          setDriverDocs={data.setDriverDocs}
          onLogout={logout}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          apiEnabled={data.apiEnabled}
          refreshAll={() => data.refreshAll(company.id)}
        />
      );
    }
  }

  return (
    <>
      {screen}
      <ToastHost />
    </>
  );
}
