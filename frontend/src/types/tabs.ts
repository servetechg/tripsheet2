import type {
  Asset,
  CarrierProfile,
  CompanyReportSummary,
  DriverDocument,
  Invite,
  Load,
  Settlement,
  TripSheet,
} from '@tripsheet/shared';
import type { Manifest } from '@/types/app';
import type {
  BillDto,
  BranchDto,
  CommentDto,
  CompanyBrandingDto,
  CompanyDocumentDto,
  CompanyEntitlementsDto,
  CompanySettingsDto,
  DvirRecordDto,
  EmploymentContractDto,
  InvoiceDto,
  MaintenanceRecordDto,
  MdmRecord,
  MessageDto,
  PaymentDto,
  PlanDto,
  PlatformCompany,
  PortOfEntryDto,
  ReportAnalyticsDto,
  SecurityPolicyDto,
} from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { Setter } from '@/types/app';
import type { CompanyWorkspaceProps } from '@/types/workspace';

export type AssetsTabProps = Pick<
  CompanyWorkspaceProps,
  'company' | 'assets' | 'setAssets' | 'apiEnabled' | 'refreshAll'
> & {
  loads: Load[];
};

export type TrackTabProps = {
  company: PlatformCompany;
  loads: Load[];
  setLoads: Setter<Load[]>;
  users: AppUser[];
  statusColor: (status: string) => string;
  apiEnabled: boolean;
  refreshAll: CompanyWorkspaceProps['refreshAll'];
};

export type MapViewProps = {
  load: Load;
  users: AppUser[];
  loads: Load[];
  tick: number;
};

export type DashboardTabProps = {
  company: PlatformCompany;
  loads: Load[];
  sheets: TripSheet[];
  drivers: AppUser[];
  trucks: Asset[];
  users: AppUser[];
  onNavigate: (tab: string) => void;
};

/** Recharts tooltip content props (not the dashboard tab shell props). */
export type DashboardChartTooltipProps = {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: number;
    fill?: string;
    payload?: { color?: string; fill?: string };
  }>;
  label?: string;
  coordinate?: { x?: number; y?: number };
  seriesNames?: string[];
};

export type EManifestTabProps = {
  company: PlatformCompany;
  manifests: Manifest[];
  setManifests: Setter<Manifest[]>;
  carrier: CarrierProfile;
  carrierProfiles: CarrierProfile[];
  setCarrierProfiles: Setter<CarrierProfile[]>;
  drivers: AppUser[];
  trucks: Asset[];
  trailers: Asset[];
  loads: Load[];
  apiEnabled: boolean;
  refreshAll: CompanyWorkspaceProps['refreshAll'];
};

export type FleetOpsTabProps = {
  company: PlatformCompany;
  assets: Asset[];
  drivers: AppUser[];
  adminUser: AppUser;
  apiEnabled: boolean;
};

export type MessagesTabProps = {
  company: PlatformCompany;
  drivers: AppUser[];
  loads: Load[];
  adminUser: AppUser;
  apiEnabled: boolean;
};

export type ComplianceTabProps = {
  company: PlatformCompany;
  drivers: AppUser[];
  driverDocs: DriverDocument[];
  assets: Asset[];
  adminUser: AppUser;
  apiEnabled: boolean;
  onGoDrivers: () => void;
};

export type AccountingTabProps = {
  company: PlatformCompany;
  drivers: AppUser[];
  sheets: TripSheet[];
  loads: Load[];
  adminUser: AppUser;
  apiEnabled: boolean;
};

export type BillingPanelProps = AccountingTabProps;

export type AdminSheetsTabProps = {
  sheets: TripSheet[];
  users: AppUser[];
  company: PlatformCompany;
  onViewPdf?: (sheet: TripSheet) => void;
};

export type CompanySettingsTabProps = {
  company: PlatformCompany;
  adminUser?: AppUser;
  apiEnabled: boolean;
  refreshAll: CompanyWorkspaceProps['refreshAll'];
  initialSub?: string;
};

export type ReportsAnalyticsView = ReportAnalyticsDto & {
  costPerMile?: number;
  fuelSpend?: number;
  driverPay?: number;
  revenueByLane?: Array<Record<string, string | number>>;
  maintenanceByTruck?: Array<Record<string, string | number>>;
  loadProfitability?: Array<
    Record<string, string | number> & {
      origin?: string;
      destination?: string;
      tripNo?: string;
    }
  >;
  invoiceAging?: {
    current?: number;
    unpaidTotal?: number;
    days30?: number;
    days60?: number;
    days90Plus?: number;
  };
  onTimePerformance?: {
    pct?: number;
    onTime?: number;
    late?: number;
  };
};

export type SmsLogEntry = {
  id?: string;
  to?: string;
  body?: string;
  status?: string;
  createdAt?: string;
  [key: string]: string | undefined;
};

export type GeneratedInviteLink = {
  token: string;
  url: string;
  invite: Invite;
};

export type DriverEditFormState = Partial<AppUser> & Record<string, string>;

export {
  type MdmRecord,
  type PortOfEntryDto,
  type BranchDto,
  type PlanDto,
  type CompanyEntitlementsDto,
  type CompanySettingsDto,
  type CompanyBrandingDto,
  type CompanyDocumentDto,
  type SecurityPolicyDto,
  type MessageDto,
  type CommentDto,
  type InvoiceDto,
  type BillDto,
  type PaymentDto,
  type MaintenanceRecordDto,
  type DvirRecordDto,
  type EmploymentContractDto,
  type Settlement,
  type CompanyReportSummary,
};
