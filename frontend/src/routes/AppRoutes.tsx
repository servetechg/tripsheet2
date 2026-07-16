import { useEffect, useState, type ReactNode } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { G, pageCentered } from '@/lib/theme';
import { Btn } from '@/components/ui';
import { ToastHost } from '@/components/feedback/Toast';
import { useAppData, type AppUser } from '@/context/AppDataContext';
import { useSession } from '@/context/SessionContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SuperAdminPanel } from '@/features/companies/SuperAdminPanel';
import { CompanyAdminPanel } from '@/features/admin/CompanyAdminPanel';
import { DriverDashboard } from '@/features/drivers/DriverDashboard';
import { DriverOnboarding } from '@/features/invites/DriverOnboarding';
import { invitesApi, companiesApi, setToken } from '@/lib/api';
import {
  PATHS,
  homePathForRole,
  isCompanyAdminTab,
  isDriverTab,
  isSuperAdminTab,
  adminTabPath,
  appTabPath,
  driverTabPath,
} from '@/lib/paths';

function BootSplash({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ ...pageCentered() }}>
      <div style={{ color: G.muted, fontSize: 14 }}>{label}</div>
    </div>
  );
}

function RequireAuth({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const { user, bootstrapping } = useSession();
  if (bootstrapping) return <BootSplash label="Restoring session…" />;
  if (!user) return <Navigate to={PATHS.login} replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const { user, bootstrapping } = useSession();
  if (bootstrapping) return <BootSplash label="Restoring session…" />;
  if (!user) return <Navigate to={PATHS.login} replace />;
  return <Navigate to={homePathForRole(user.role)} replace />;
}

function LoginRoute() {
  const data = useAppData();
  const { user, bootstrapping, login, themeMode, toggleTheme } = useSession();
  const navigate = useNavigate();

  if (bootstrapping) return <BootSplash label="Restoring session…" />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <LoginScreen
      onLogin={(u: AppUser) => {
        login(u);
        navigate(homePathForRole(u.role), { replace: true });
      }}
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      apiEnabled={data.apiEnabled}
      apiError={data.apiError}
      onRetryApi={() => void data.refreshAll()}
    />
  );
}

function InviteRoute() {
  const data = useAppData();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const inviteToken = search.get('invite');
  const [inviteState, setInviteState] = useState<{
    loading: boolean;
    invite: any | null;
    company: any | null;
    error: boolean;
  }>({ loading: true, invite: null, company: null, error: false });

  useEffect(() => {
    if (!inviteToken) {
      setInviteState({
        loading: false,
        invite: null,
        company: null,
        error: true,
      });
      return;
    }
    if (!data.apiEnabled) {
      // Wait until initial API ping finishes before failing
      if (!data.loading) {
        setInviteState({
          loading: false,
          invite: null,
          company: null,
          error: true,
        });
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setInviteState((s) =>
        s.invite ? s : { ...s, loading: true },
      );
      try {
        const inv = await invitesApi.byToken(inviteToken);
        const co = await companiesApi.get(inv.companyId);
        if (!cancelled) {
          setInviteState({
            loading: false,
            invite: inv,
            company: co,
            error: false,
          });
        }
      } catch {
        if (!cancelled) {
          setInviteState({
            loading: false,
            invite: null,
            company: null,
            error: true,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-fetch when token or API availability changes — not on every data.loading flip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken, data.apiEnabled]);

  if (!inviteToken) {
    return <Navigate to={PATHS.login} replace />;
  }

  // Don't remount the form when background refresh sets data.loading
  if (inviteState.loading || (!inviteState.invite && data.loading)) {
    return <BootSplash label="Loading invite…" />;
  }

  if (!data.apiEnabled) {
    return (
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
            {data.apiError ||
              'API is offline — invite onboarding requires the live gateway.'}
          </div>
          <Btn size="sm" onClick={() => void data.refreshAll()}>
            Retry
          </Btn>
        </div>
      </div>
    );
  }

  if (inviteState.invite && inviteState.company) {
    const invite = inviteState.invite;
    const company = inviteState.company;
    return (
      <DriverOnboarding
        invite={invite}
        company={company}
        onComplete={async (profile: any, docs: any, contract: any) => {
          // Auth user is created inside driver-service via internal auth API
          // (invite flow has no JWT — do not call authApi.createUser here).
          await invitesApi.complete(inviteToken, {
            profile: {
              name: profile.name,
              email: profile.email,
              password: profile.password,
              phone: profile.phone,
              dob: profile.dob,
              licenseNo: profile.licenseNo,
              citizenship: profile.citizenship,
              address: profile.address,
              emergencyName: profile.emergencyName,
              emergencyPhone: profile.emergencyPhone,
              fastCard: profile.fastCard,
              notes: profile.notes,
            },
            docs: (docs || []).map((d: any) => ({
              type: d.type,
              fileName: d.fileName,
              fileSize:
                typeof d.fileSize === 'number'
                  ? d.fileSize
                  : undefined,
              fileType: d.fileType,
              fileData: d.fileData,
              uploadedAt: d.uploadedAt,
              expiryDate: d.expiryDate || undefined,
              notes: d.notes || undefined,
              status: d.status || 'uploaded',
            })),
            contract: {
              ...contract,
              driverName: profile.name,
              companyName: company.name,
              signedByDriver: true,
              signedAt: new Date().toISOString(),
            },
          });
          setToken(null);
          navigate(PATHS.login, { replace: true });
        }}
      />
    );
  }

  return (
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
        <div style={{ fontSize: 11, color: G.muted, marginBottom: 16 }}>
          Contact your employer for a new link.
        </div>
        <Btn size="sm" onClick={() => navigate(PATHS.login)}>
          Go to login
        </Btn>
      </div>
    </div>
  );
}

function SuperAdminRoute() {
  const data = useAppData();
  const { user, logout, themeMode, toggleTheme } = useSession();
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const tab = isSuperAdminTab(rawTab) ? rawTab : 'companies';

  useEffect(() => {
    if (!isSuperAdminTab(rawTab)) {
      navigate(adminTabPath('companies'), { replace: true });
    }
  }, [rawTab, navigate]);

  useEffect(() => {
    void data.refreshAll('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <SuperAdminPanel
      companies={data.companies}
      setCompanies={data.setCompanies}
      users={data.users}
      setUsers={data.setUsers}
      onLogout={() => {
        logout();
        navigate(PATHS.login, { replace: true });
      }}
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      apiEnabled={data.apiEnabled}
      refreshAll={data.refreshAll}
      activeTab={tab}
      onTabChange={(id: string) => navigate(adminTabPath(id))}
    />
  );
}

function CompanyWorkspace() {
  const data = useAppData();
  const { user, logout, themeMode, toggleTheme } = useSession();
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const tab = isCompanyAdminTab(rawTab) ? rawTab : 'dispatch';

  useEffect(() => {
    if (!isCompanyAdminTab(rawTab)) {
      navigate(appTabPath('dispatch'), { replace: true });
    }
  }, [rawTab, navigate]);

  useEffect(() => {
    if (user?.companyId) void data.refreshAll(user.companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.companyId]);

  if (!user) return null;

  if (data.loading && data.companies.length === 0) {
    return <BootSplash label="Loading company…" />;
  }

  const freshSession =
    data.users.find((u) => u.id === user.id) || (user as AppUser);
  const company = data.companies.find((c) => c.id === freshSession.companyId);

  if (!company && data.loading) {
    return <BootSplash label="Loading company…" />;
  }

  if (!company || !company.active) {
    return (
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
          <Btn
            full
            onClick={() => {
              logout();
              navigate(PATHS.login, { replace: true });
            }}
            style={{ padding: 15, fontSize: 14 }}
          >
            BACK TO LOGIN
          </Btn>
        </div>
      </div>
    );
  }

  if (freshSession.role === 'company_admin') {
    return (
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
        onLogout={() => {
          logout();
          navigate(PATHS.login, { replace: true });
        }}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        apiEnabled={data.apiEnabled}
        refreshAll={() => data.refreshAll(company.id)}
        activeTab={tab}
        onTabChange={(id: string) => navigate(appTabPath(id))}
      />
    );
  }

  return <Navigate to={homePathForRole(freshSession.role)} replace />;
}

function DriverWorkspace() {
  const data = useAppData();
  const { user, logout, themeMode, toggleTheme } = useSession();
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const tab = isDriverTab(rawTab) ? rawTab : 'sheets';

  useEffect(() => {
    if (!isDriverTab(rawTab)) {
      navigate(driverTabPath('sheets'), { replace: true });
    }
  }, [rawTab, navigate]);

  useEffect(() => {
    if (user?.companyId) void data.refreshAll(user.companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.companyId]);

  if (!user) return null;

  if (data.loading && data.companies.length === 0) {
    return <BootSplash label="Loading…" />;
  }

  const freshSession =
    data.users.find((u) => u.id === user.id) || (user as AppUser);
  const company = data.companies.find((c) => c.id === freshSession.companyId);

  if (!company && data.loading) {
    return <BootSplash label="Loading company…" />;
  }

  if (!company || !company.active) {
    return (
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
          <Btn
            full
            onClick={() => {
              logout();
              navigate(PATHS.login, { replace: true });
            }}
            style={{ padding: 15, fontSize: 14 }}
          >
            BACK TO LOGIN
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <DriverDashboard
      user={freshSession}
      company={company}
      sheets={data.sheets}
      setSheets={data.setSheets}
      loads={data.loads}
      driverDocs={data.driverDocs}
      setDriverDocs={data.setDriverDocs}
      onLogout={() => {
        logout();
        navigate(PATHS.login, { replace: true });
      }}
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      apiEnabled={data.apiEnabled}
      refreshAll={() => data.refreshAll(company.id)}
      activeTab={tab}
      onTabChange={(id: string) => navigate(driverTabPath(id))}
    />
  );
}

/** Role-based routes with persisted session + URL tabs. */
export function AppRoutes() {
  const [search] = useSearchParams();
  const inviteToken = search.get('invite');
  const path = window.location.pathname;

  useEffect(() => {
    if (document.getElementById('ts-font-link')) return;
    const link = document.createElement('link');
    link.id = 'ts-font-link';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);

  // Any legacy link with ?invite= on a non-invite path
  if (inviteToken && path !== PATHS.invite) {
    return (
      <Navigate
        to={`${PATHS.invite}?invite=${encodeURIComponent(inviteToken)}`}
        replace
      />
    );
  }

  return (
    <>
      <Routes>
        <Route path={PATHS.login} element={<LoginRoute />} />
        <Route path={PATHS.invite} element={<InviteRoute />} />
        <Route
          path={`${PATHS.admin}/:tab?`}
          element={
            <RequireAuth roles={['superadmin']}>
              <SuperAdminRoute />
            </RequireAuth>
          }
        />
        <Route
          path={`${PATHS.app}/:tab?`}
          element={
            <RequireAuth roles={['company_admin']}>
              <CompanyWorkspace />
            </RequireAuth>
          }
        />
        <Route
          path={`${PATHS.driver}/:tab?`}
          element={
            <RequireAuth roles={['driver']}>
              <DriverWorkspace />
            </RequireAuth>
          }
        />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  );
}
