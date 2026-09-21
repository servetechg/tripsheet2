import type { Dispatch, SetStateAction } from 'react';
import type {
  Asset,
  CarrierProfile,
  DriverDocument,
  Expense,
  Invite,
  Load,
  TripLeg,
  TripSheet,
} from '@tripsheet/shared';
import type { Manifest } from '@/types/app';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';

/** Props shared by most company-scoped admin tabs. */
export type CompanyWorkspaceProps = {
  company: PlatformCompany;
  loads: Load[];
  setLoads: Dispatch<SetStateAction<Load[]>>;
  assets: Asset[];
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  users: AppUser[];
  setUsers: Dispatch<SetStateAction<AppUser[]>>;
  sheets: TripSheet[];
  setSheets: Dispatch<SetStateAction<TripSheet[]>>;
  manifests: Manifest[];
  setManifests: Dispatch<SetStateAction<Manifest[]>>;
  carrierProfiles: CarrierProfile[];
  setCarrierProfiles: Dispatch<SetStateAction<CarrierProfile[]>>;
  driverDocs: DriverDocument[];
  setDriverDocs: Dispatch<SetStateAction<DriverDocument[]>>;
  invites: Invite[];
  setInvites: Dispatch<SetStateAction<Invite[]>>;
  apiEnabled: boolean;
  refreshAll: (
    companyId?: string | null,
    scope?: 'full' | 'driver',
  ) => Promise<void>;
};

export type ThemeProps = {
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
};

export type ShellTabProps = {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onLogout: () => void;
};

export type CompanyAdminPanelProps = CompanyWorkspaceProps &
  ThemeProps &
  ShellTabProps & {
    adminUser: AppUser;
  };

export type SuperAdminPanelProps = ThemeProps &
  ShellTabProps & {
    companies: PlatformCompany[];
    setCompanies: Dispatch<SetStateAction<PlatformCompany[]>>;
    users: AppUser[];
    setUsers: Dispatch<SetStateAction<AppUser[]>>;
    apiEnabled: boolean;
    refreshAll: CompanyWorkspaceProps['refreshAll'];
    loading?: boolean;
  };

export type BottomNavProps = {
  tabs: import('@/types/app').NavTab[];
  active: string;
  onChange: (tabId: string) => void;
};

export type ThemeToggleProps = {
  mode: 'light' | 'dark';
  onToggle: () => void;
};

export type SheetPrintPreviewState = {
  header: TripSheet['header'];
  trips: TripLeg[];
  expenses: Expense[];
  notes: string;
};
