/**
 * App shell, context, main entry, and package config.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');

function write(rel, content, base = src) {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n');
  console.log('✓', rel);
}

write(
  'context/AppDataContext.tsx',
  `import { createContext, useContext, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { Company, Asset, Load, CarrierProfile, TripSheet, DriverDocument, Invite } from '@tripsheet/shared';
import {
  SEED_COMPANIES,
  SEED_USERS,
  SEED_ASSETS,
  SEED_LOADS,
  SEED_CARRIER_PROFILES,
  type SeedUser,
} from '@/data/seed';
import { usePersisted } from '@/hooks/usePersisted';

export type Manifest = Record<string, any>;

interface AppData {
  companies: Company[];
  setCompanies: Dispatch<SetStateAction<Company[]>>;
  users: SeedUser[];
  setUsers: Dispatch<SetStateAction<SeedUser[]>>;
  sheets: TripSheet[];
  setSheets: Dispatch<SetStateAction<TripSheet[]>>;
  loads: Load[];
  setLoads: Dispatch<SetStateAction<Load[]>>;
  assets: Asset[];
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  manifests: Manifest[];
  setManifests: Dispatch<SetStateAction<Manifest[]>>;
  carrierProfiles: CarrierProfile[];
  setCarrierProfiles: Dispatch<SetStateAction<CarrierProfile[]>>;
  driverDocs: DriverDocument[];
  setDriverDocs: Dispatch<SetStateAction<DriverDocument[]>>;
  invites: Invite[];
  setInvites: Dispatch<SetStateAction<Invite[]>>;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = usePersisted('ts_companies', SEED_COMPANIES);
  const [users, setUsers] = usePersisted('ts_users', SEED_USERS);
  const [sheets, setSheets] = usePersisted<TripSheet[]>('ts_sheets', []);
  const [loads, setLoads] = usePersisted('ts_loads', SEED_LOADS);
  const [assets, setAssets] = usePersisted('ts_assets', SEED_ASSETS);
  const [manifests, setManifests] = usePersisted<Manifest[]>('ts_manifests', []);
  const [carrierProfiles, setCarrierProfiles] = usePersisted('ts_carriers', SEED_CARRIER_PROFILES);
  const [driverDocs, setDriverDocs] = usePersisted<DriverDocument[]>('ts_driverdocs', []);
  const [invites, setInvites] = usePersisted<Invite[]>('ts_invites', []);

  return (
    <AppDataContext.Provider
      value={{
        companies, setCompanies,
        users, setUsers,
        sheets, setSheets,
        loads, setLoads,
        assets, setAssets,
        manifests, setManifests,
        carrierProfiles, setCarrierProfiles,
        driverDocs, setDriverDocs,
        invites, setInvites,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
`
);

write(
  'App.tsx',
  `import { useEffect, useState, type ReactNode } from 'react';
import { G, pageCentered, applyTheme, type ThemeMode } from '@/lib/theme';
import { Btn } from '@/components/ui';
import { ToastHost } from '@/components/feedback/Toast';
import { AppDataProvider, useAppData } from '@/context/AppDataContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SuperAdminPanel } from '@/features/companies/SuperAdminPanel';
import { CompanyAdminPanel } from '@/features/admin/CompanyAdminPanel';
import { DriverDashboard } from '@/features/drivers/DriverDashboard';
import { DriverOnboarding } from '@/features/invites/DriverOnboarding';
import { uid } from '@/lib/uid';
import type { SeedUser } from '@/data/seed';

function AppRoutes() {
  const data = useAppData();
  const [session, setSession] = useState<SeedUser | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  applyTheme(themeMode);
  const toggleTheme = () => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  const logout = () => setSession(null);

  useEffect(() => {
    if (document.getElementById('ts-font-link')) return;
    const link = document.createElement('link');
    link.id = 'ts-font-link';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);

  let screen: ReactNode;

  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('invite');

  if (inviteToken) {
    const invite = data.invites.find((i) => i.token === inviteToken && i.status === 'pending');
    const company = invite ? data.companies.find((c) => c.id === invite.companyId) : null;
    if (invite && company) {
      screen = (
        <DriverOnboarding
          invite={invite}
          company={company}
          onComplete={(profile: any, docs: any, contract: any) => {
            const driverId = uid();
            data.setUsers((p) => [
              ...p,
              {
                id: driverId,
                name: profile.name,
                email: profile.email,
                password: profile.password,
                role: 'driver',
                companyId: invite.companyId,
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
            ]);
            if (docs && docs.length > 0) {
              data.setDriverDocs((p) => [
                ...p,
                ...docs.map((d: any) => ({ ...d, driverId, companyId: invite.companyId })),
              ]);
            }
            if (contract) {
              data.setDriverDocs((p) => [
                ...p,
                { ...contract, type: '__contract__', driverId, companyId: invite.companyId },
              ]);
            }
            data.setInvites((p) =>
              p.map((i) =>
                i.token === inviteToken
                  ? {
                      ...i,
                      status: 'completed',
                      completedAt: new Date().toLocaleDateString('en-CA'),
                      driverId,
                    }
                  : i,
              ),
            );
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
              border: \`1px solid \${G.danger}44\`,
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
        users={data.users}
        onLogin={setSession}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
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
              border: \`1px solid \${G.border}\`,
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

export default function App() {
  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}
`
);

write(
  'main.tsx',
  `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`
);

// Package / tsconfig / vite / index.html
fs.writeFileSync(
  path.join(root, 'package.json'),
  JSON.stringify(
    {
      name: 'tripsheet',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        lint: 'oxlint',
        preview: 'vite preview',
      },
      dependencies: {
        '@tripsheet/shared': 'file:../shared',
        react: '^19.2.7',
        'react-dom': '^19.2.7',
        'react-router-dom': '^7.6.2',
      },
      devDependencies: {
        '@types/react': '^19.2.17',
        '@types/react-dom': '^19.2.3',
        '@vitejs/plugin-react': '^6.0.3',
        oxlint: '^1.71.0',
        typescript: '~5.8.2',
        vite: '^8.1.1',
      },
    },
    null,
    2,
  ) + '\n',
);

fs.writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify(
    {
      files: [],
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
    },
    null,
    2,
  ) + '\n',
);

fs.writeFileSync(
  path.join(root, 'tsconfig.app.json'),
  JSON.stringify(
    {
      compilerOptions: {
        tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
          '@tripsheet/shared': ['../shared/src/index.ts'],
          '@tripsheet/shared/*': ['../shared/src/*'],
        },
      },
      include: ['src'],
    },
    null,
    2,
  ) + '\n',
);

fs.writeFileSync(
  path.join(root, 'tsconfig.node.json'),
  JSON.stringify(
    {
      compilerOptions: {
        tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
        target: 'ES2023',
        lib: ['ES2023'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        moduleDetection: 'force',
        noEmit: true,
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ['vite.config.ts'],
    },
    null,
    2,
  ) + '\n',
);

fs.writeFileSync(
  path.join(root, 'vite.config.ts'),
  `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tripsheet/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
})
`,
);

fs.writeFileSync(
  path.join(root, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TripSheet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
);

console.log('App + config written');
