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
import { isCompanyOwnerRole } from '@tripsheet/shared';
import {
  pingApi,
  checkBackendServices,
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
  active?: boolean;
  lifecycleStatus?: string;
  driverType?: string;
  employeeNumber?: string;
  employmentStatus?: string;
  hireDate?: string;
  probationEndDate?: string;
  seniorityDate?: string;
  branchId?: string;
  managerUserId?: string;
  dispatcherUserId?: string;
  preferredName?: string;
  preferredLanguage?: string;
  ownerOperatorProfile?: Record<string, unknown>;
  qualifications?: any[];
  availabilityStatus?: string;
};

export type RefreshScope = 'full' | 'driver';

interface AppData {
  apiEnabled: boolean;
  apiError: string | null;
  servicesDown: string[];
  loading: boolean;
  refreshAll: (
    companyId?: string | null,
    scope?: RefreshScope,
  ) => Promise<void>;

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
    // Super Admin + entitlements need full platform row (plan, tenant DB, slug)
    slug: c.slug,
    status: c.status,
    planId: c.planId,
    plan: c.plan,
    subscription: c.subscription,
    tenantDatabase: c.tenantDatabase,
  } as Company;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [servicesDown, setServicesDown] = useState<string[]>([]);
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

  const refreshAll = useCallback(async (
    companyId?: string | null,
    scope: RefreshScope = 'full',
  ) => {
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

    const health = await checkBackendServices();
    setServicesDown(health.down);

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
        const driverScope = scope === 'driver';
        const [drv, docs, sh] = await Promise.all([
          driversApi.list(companyId).catch(() => []),
          documentsApi.list({ companyId }).catch(() => []),
          tripSheetsApi.list({ companyId }).catch(() => []),
        ]);

        let inv: Invite[] = [];
        let ast: Asset[] = [];
        let lds: Load[] = [];
        let man: Manifest[] = [];
        let carrier: CarrierProfile | null = null;

        if (!driverScope) {
          [inv, ast, lds, man, carrier] = await Promise.all([
            invitesApi.list(companyId).catch(() => []),
            assetsApi.list(companyId).catch(() => []),
            loadsApi.list({ companyId }).catch(() => []),
            manifestsApi.list(companyId).catch(() => []),
            carrierProfilesApi.get(companyId).catch(() => null),
          ]);
        }

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
          active: d.active !== false,
          lifecycleStatus: d.lifecycleStatus || (d.active === false ? 'suspended' : 'active'),
          driverType: d.driverType,
          employeeNumber: d.employeeNumber,
          employmentStatus: d.employmentStatus,
          hireDate: d.hireDate,
          probationEndDate: d.probationEndDate,
          seniorityDate: d.seniorityDate,
          branchId: d.branchId,
          managerUserId: d.managerUserId,
          dispatcherUserId: d.dispatcherUserId,
          preferredName: d.preferredName,
          preferredLanguage: d.preferredLanguage,
          ownerOperatorProfile: d.ownerOperatorProfile,
          qualifications: d.qualifications,
          availabilityStatus: d.availabilityStatus || 'available',
        }));

        setUsers((prev) => {
          const supers = prev.filter((u) => u.role === 'superadmin');
          const admins = prev.filter(
            (u) => isCompanyOwnerRole(u.role) && u.companyId === companyId,
          );
          const prevDrivers = prev.filter(
            (u) => u.role === 'driver' && u.companyId === companyId,
          );
          const byEmail = new Map<string, AppUser>();
          for (const d of prevDrivers) {
            if (d.email) byEmail.set(d.email.toLowerCase(), d);
          }
          for (const d of driverUsers) {
            if (d.email) byEmail.set(d.email.toLowerCase(), d);
          }
          return [...supers, ...admins, ...Array.from(byEmail.values())];
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
      servicesDown,
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
      servicesDown,
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
