import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Company, Asset, Load, CarrierProfile, TripSheet, Invite } from '@tripsheet/shared';
import type { Role } from '@tripsheet/shared';
import {
  pingApi,
  companiesApi,
  authApi,
  driversApi,
  documentsApi,
  invitesApi,
  assetsApi,
  loadsApi,
  manifestsApi,
  carrierProfilesApi,
  tripSheetsApi,
  setToken,
  getToken,
  type AuthUserDto,
} from '@/lib/api';

export type Manifest = Record<string, unknown> & {
  id: string;
  companyId: string;
  type?: string;
  status?: string;
};

export type AppUser = AuthUserDto & {
  role: Role | string;
  password?: string;
  driverRecordId?: string;
  phone?: string;
  dob?: string;
  licenseNo?: string;
  citizenship?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  fastCard?: string;
  notes?: string;
  sin?: string;
};

interface AppData {
  apiEnabled: boolean;
  apiError: string | null;
  loading: boolean;
  refreshAll: (companyId?: string | null) => Promise<void>;

  companies: Company[];
  setCompanies: Dispatch<SetStateAction<Company[]>>;
  users: AppUser[];
  setUsers: Dispatch<SetStateAction<AppUser[]>>;
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
  driverDocs: any[];
  setDriverDocs: Dispatch<SetStateAction<any[]>>;
  invites: Invite[];
  setInvites: Dispatch<SetStateAction<Invite[]>>;
}

const AppDataContext = createContext<AppData | null>(null);

function asCompany(c: any): Company {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    tagline: c.tagline ?? '',
    address: c.address ?? '',
    active: c.active !== false,
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sheets, setSheets] = useState<TripSheet[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [carrierProfiles, setCarrierProfiles] = useState<CarrierProfile[]>([]);
  const [driverDocs, setDriverDocs] = useState<any[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const refreshAll = useCallback(async (companyId?: string | null) => {
    setLoading(true);
    const live = await pingApi();
    setApiEnabled(live);
    if (!live) {
      setApiError(
        'API gateway is unreachable. Start backend with `npm run start:dev` in /backend (and Docker for Postgres).',
      );
      setLoading(false);
      return;
    }
    setApiError(null);

    try {
      const cos = await companiesApi.list();
      setCompanies(cos.map(asCompany));

      if (getToken()) {
        try {
          const allUsers = await authApi.listUsers(
            companyId && companyId !== 'all' ? companyId : undefined,
          );
          setUsers(
            allUsers.map((u) => ({
              ...u,
              companyId: u.companyId ?? null,
            })),
          );
        } catch {
          // list users may fail if token invalid — ignore here
        }
      }

      if (companyId && companyId !== 'all') {
        const [drv, docs, inv, ast, lds, man, carrier, sh] = await Promise.all([
          driversApi.list(companyId).catch(() => []),
          documentsApi.list({ companyId }).catch(() => []),
          invitesApi.list(companyId).catch(() => []),
          assetsApi.list(companyId).catch(() => []),
          loadsApi.list({ companyId }).catch(() => []),
          manifestsApi.list(companyId).catch(() => []),
          carrierProfilesApi.get(companyId).catch(() => null),
          tripSheetsApi.list({ companyId }).catch(() => []),
        ]);

        const driverUsers: AppUser[] = (drv as any[]).map((d) => ({
          id: d.userId || d.id,
          driverRecordId: d.id,
          name: d.name,
          email: d.email,
          role: 'driver',
          companyId: d.companyId,
          phone: d.phone,
          dob: d.dob,
          licenseNo: d.licenseNo,
          citizenship: d.citizenship,
          address: d.address,
          emergencyName: d.emergencyName,
          emergencyPhone: d.emergencyPhone,
          fastCard: d.fastCard,
          notes: d.notes,
          sin: d.sin,
        }));

        setUsers((prev) => {
          const supers = prev.filter((u) => u.role === 'superadmin');
          const admins = prev.filter(
            (u) => u.role === 'company_admin' && u.companyId === companyId,
          );
          return [...supers, ...admins, ...driverUsers];
        });

        setDriverDocs(docs);
        setInvites(inv as Invite[]);
        setAssets(ast as Asset[]);
        setLoads(lds as Load[]);
        setManifests(man as Manifest[]);
        if (carrier) {
          setCarrierProfiles([carrier as CarrierProfile]);
        } else {
          setCarrierProfiles([]);
        }
        setSheets(sh as TripSheet[]);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Failed to load API data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const value = useMemo<AppData>(
    () => ({
      apiEnabled,
      apiError,
      loading,
      refreshAll,
      companies,
      setCompanies,
      users,
      setUsers,
      sheets,
      setSheets,
      loads,
      setLoads,
      assets,
      setAssets,
      manifests,
      setManifests,
      carrierProfiles,
      setCarrierProfiles,
      driverDocs,
      setDriverDocs,
      invites,
      setInvites,
    }),
    [
      apiEnabled,
      apiError,
      loading,
      refreshAll,
      companies,
      users,
      sheets,
      loads,
      assets,
      manifests,
      carrierProfiles,
      driverDocs,
      invites,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}

export { setToken, getToken };
