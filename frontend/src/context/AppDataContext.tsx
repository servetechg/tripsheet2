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
import type {
  Asset,
  CarrierProfile,
  DriverDocument,
  Invite,
  Load,
  TripSheet,
} from '@tripsheet/shared';
import { isCompanyOwnerRole, isDriverRole } from '@tripsheet/shared';
import type { Manifest } from '@/types/app';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';

export type { AppUser };
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
} from '@/lib/api';

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

  companies: PlatformCompany[];
  setCompanies: Dispatch<SetStateAction<PlatformCompany[]>>;
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
  driverDocs: DriverDocument[];
  setDriverDocs: Dispatch<SetStateAction<DriverDocument[]>>;
  invites: Invite[];
  setInvites: Dispatch<SetStateAction<Invite[]>>;
}

const AppDataContext = createContext<AppData | null>(null);

function asCompany(c: PlatformCompany): PlatformCompany {
  return {
    ...c,
    tagline: c.tagline ?? '',
    address: c.address ?? '',
    active: c.active !== false,
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [servicesDown, setServicesDown] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sheets, setSheets] = useState<TripSheet[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [carrierProfiles, setCarrierProfiles] = useState<CarrierProfile[]>([]);
  const [driverDocs, setDriverDocs] = useState<DriverDocument[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const refreshAll = useCallback(async (
    companyId?: string | null,
    scope: RefreshScope = 'full',
  ) => {
    const hasToken = Boolean(getToken());
    if (hasToken || companyId) setLoading(true);

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

    if (!hasToken && !companyId) {
      setLoading(false);
      return;
    }

    try {
      let cosList: PlatformCompany[] = [];
      if (hasToken) {
        // Resolve the signed-in tenant first (list can lag or fail for non–super-admin).
        if (companyId && companyId !== 'all') {
          try {
            const one = await companiesApi.get(companyId);
            cosList = [asCompany(one)];
          } catch (err) {
            cosList = [];
            if (scope === 'driver') {
              const detail =
                err instanceof Error ? err.message : 'request failed';
              setApiError(
                `Company profile could not be loaded (${detail}). Check gateway (port 3000) and company-service (port 3002).`,
              );
            }
          }
        }
        try {
          const cos = await companiesApi.list();
          for (const row of cos.map(asCompany)) {
            if (!cosList.some((c) => c.id === row.id)) cosList.push(row);
          }
        } catch {
          // keep companyId fetch result when list fails
        }
      }
      setCompanies(cosList);

      let authUsers: AppUser[] = [];
      if (getToken()) {
        try {
          const allUsers = await authApi.listUsers(
            companyId && companyId !== 'all' ? companyId : undefined,
          );
          authUsers = allUsers.map((u) => ({
            ...u,
            companyId: u.companyId ?? null,
            driverRecordId: u.driverRecordId ?? u.driverId ?? null,
            active:
              u.status !== 'suspended' &&
              u.status !== 'archived' &&
              u.active !== false,
            lifecycleStatus:
              u.lifecycleStatus ||
              (u.status === 'suspended'
                ? 'suspended'
                : u.status === 'archived'
                  ? 'archived'
                  : 'active'),
          }));
          const scopeLoadsDrivers =
            Boolean(companyId && companyId !== 'all');
          setUsers(
            scopeLoadsDrivers
              ? authUsers.filter((u) => !isDriverRole(u.role))
              : authUsers,
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

        if (driverScope) {
          lds = await loadsApi.list({ companyId }).catch(() => []);
        } else {
          [inv, ast, lds, man, carrier] = await Promise.all([
            invitesApi.list(companyId).catch(() => []),
            assetsApi.list(companyId).catch(() => []),
            loadsApi.list({ companyId }).catch(() => []),
            manifestsApi.list(companyId).catch((error: unknown) => {
              const detail =
                error instanceof Error ? error.message : 'request failed';
              setApiError(`eManifest data unavailable: ${detail}`);
              return [];
            }),
            carrierProfilesApi.get(companyId).catch(() => null),
          ]);
        }

        const authByUserId = new Map(
          authUsers
            .filter((u) => u.companyId === companyId)
            .map((u) => [u.id, u] as const),
        );

        const driverUsers: AppUser[] = drv.map((d) => {
          const authId = d.userId || d.id;
          const authUser = authByUserId.get(authId);
          return {
          id: authId,
          driverRecordId: d.id,
          name: authUser?.name || d.name,
          email: authUser?.email || d.email,
          pendingEmail: authUser?.pendingEmail ?? null,
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
        };
        });

        setUsers((prev) => {
          const supers = prev.filter((u) => u.role === 'superadmin');
          const admins = prev.filter(
            (u) => isCompanyOwnerRole(u.role) && u.companyId === companyId,
          );
          const prevDrivers = prev.filter(
            (u) =>
              isDriverRole(u.role) &&
              u.companyId === companyId &&
              Boolean(u.driverRecordId),
          );
          const byKey = new Map<string, AppUser>();
          const byEmail = new Map<string, string>();

          const putDriver = (d: AppUser) => {
            const key = String(d.driverRecordId || d.id);
            if (!key) return;
            const email = d.email?.toLowerCase();
            if (email && byEmail.has(email)) {
              byKey.delete(byEmail.get(email)!);
            }
            byKey.set(key, d);
            if (email) byEmail.set(email, key);
          };

          for (const d of prevDrivers) putDriver(d);
          for (const d of driverUsers) putDriver(d);

          return [...supers, ...admins, ...Array.from(byKey.values())];
        });

        setDriverDocs(docs);
        setInvites(inv);
        setAssets(ast);
        setLoads(lds);
        setManifests(man);
        if (carrier) {
          setCarrierProfiles([carrier]);
        } else {
          setCarrierProfiles([]);
        }
        setSheets(sh);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Failed to load API data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Always ping gateway on mount (login page has no token yet).
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
