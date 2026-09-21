import type {
  DriverDocument,
  Invite,
  Load,
  TripSheet,
} from '@tripsheet/shared';
import type { EmploymentContractDto, PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { Setter } from '@/types/app';

export type DriversTabProps = {
  company: PlatformCompany;
  drivers: AppUser[];
  setUsers: Setter<AppUser[]>;
  users: AppUser[];
  loads: Load[];
  sheets: TripSheet[];
  driverDocs: DriverDocument[];
  setDriverDocs: Setter<DriverDocument[]>;
  invites: Invite[];
  setInvites: Setter<Invite[]>;
  apiEnabled: boolean;
  refreshAll: (
    companyId?: string | null,
    scope?: 'full' | 'driver',
  ) => Promise<void>;
};

/** Contract row in driver UI (API DTO or legacy `__contract__` vault doc). */
export type DriverContractView = EmploymentContractDto & {
  type?: string;
  fileName?: string;
  fileData?: string;
};

export function asDriverContract(
  value: DriverDocument | EmploymentContractDto | null | undefined,
): DriverContractView | null {
  if (!value) return null;
  return value as DriverContractView;
}

export type DriverDashboardProps = {
  user: AppUser;
  company: PlatformCompany;
  loads: Load[];
  setLoads: Setter<Load[]>;
  sheets: TripSheet[];
  setSheets: Setter<TripSheet[]>;
  driverDocs: DriverDocument[];
  setDriverDocs: Setter<DriverDocument[]>;
  apiEnabled: boolean;
  refreshAll: (
    companyId?: string | null,
    scope?: 'full' | 'driver',
  ) => Promise<void>;
  onLogout: () => void;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
};

export type DriverProfileProps = {
  driver: AppUser;
  company: PlatformCompany;
  loads: Load[];
  sheets: TripSheet[];
  driverDocs: DriverDocument[];
  setDriverDocs: Setter<DriverDocument[]>;
  onEdit: () => void;
  onBack: () => void;
  apiEnabled: boolean;
  refreshAll: DriversTabProps['refreshAll'];
};
