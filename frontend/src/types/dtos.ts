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

/** Company row from company-service (platform + tenant metadata). */
export type PlatformCompany = {
  id: string;
  name: string;
  shortName: string;
  tagline?: string;
  address?: string;
  active: boolean;
  slug?: string;
  status?: string;
  planId?: string;
  planCode?: string;
  plan?: PlanDto;
  subscription?: SubscriptionDto;
  tenantDatabase?: TenantDatabaseDto;
};

export type PlanDto = {
  id: string;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
  entitlements?: Record<string, unknown>;
};

export type SubscriptionDto = {
  id?: string;
  planId?: string;
  status?: string;
  currentPeriodEnd?: string;
};

export type TenantDatabaseDto = {
  id?: string;
  status?: string;
  schemaVersion?: string;
  lastMigratedAt?: string;
  dbName?: string;
  issue?: string;
};

export type TenantRowDto = {
  companyId: string;
  status: string;
  databaseName?: string;
  provisionedAt?: string;
  schemaVersion?: string;
};

export type TenantOpsSummaryDto = {
  tenants?: number;
  provisioned?: number;
  pending?: number;
  failed?: number;
  lastProvisionAt?: string | null;
  generatedAt?: string;
  totals?: Record<string, number>;
  recentErrors?: Array<{ companyId?: string; message: string; at?: string }>;
};

export type CompanyEntitlementsDto = {
  companyId: string;
  planCode?: string;
  features?: Record<string, boolean>;
  maxDrivers?: number;
  maxUsers?: number;
  planName?: string;
  subscriptionStatus?: string;
  [key: string]: unknown;
};

export type CompanySettingsGeneralDto = {
  currency?: string;
  timeZone?: string;
  distanceUnit?: string;
};

export type CompanySettingsDispatchDto = {
  autoDispatchNumber?: boolean;
  driverAcceptanceRequired?: boolean;
};

export type CompanySettingsDto = {
  companyId: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  general?: CompanySettingsGeneralDto;
  dispatch?: CompanySettingsDispatchDto;
  driver?: Record<string, unknown>;
  accounting?: Record<string, unknown>;
  maintenance?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
};

export type CompanyBrandingDto = {
  companyId: string;
  logoUrl?: string;
  logoData?: string;
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  invoiceHeader?: string;
  invoiceFooter?: string;
};

/** Shared MDM / reference row shape (company-service catalogs). */
export type MdmRecord = {
  id: string;
  companyId?: string;
  code?: string;
  name: string;
  label?: string;
  active?: boolean;
  status?: string;
  country?: string;
  city?: string;
  province?: string;
  state?: string;
  address?: string;
  postalCode?: string;
  selectable?: boolean;
  phone?: string;
  email?: string;
  notes?: string;
  mc?: string;
  hazmat?: boolean;
  region?: string;
  line1?: string;
  postal?: string;
  dot?: string;
  nmfc?: string;
  hours?: string;
  brand?: string;
  kind?: string;
  borderCrossingName?: string;
  docks?: string | number;
  locationId?: string;
  insuranceExpiry?: string;
  safetyRating?: string;
  timeZone?: string;
  currency?: string;
};

export type PortOfEntryDto = MdmRecord & {
  ace?: boolean;
  aci?: boolean;
  paps?: boolean;
  pars?: boolean;
};

export type PortCustomsDto = {
  portId?: string;
  portOfEntryCode?: string;
  portOfEntryName?: string;
  ace?: boolean;
  aci?: boolean;
  paps?: boolean;
  pars?: boolean;
  program?: string;
  defaultProgram?: string;
  customsAce?: boolean;
  customsAci?: boolean;
  customsPaps?: boolean;
  customsPars?: boolean;
};

export type BranchDto = MdmRecord & { isDefault?: boolean };
export type DepartmentDto = MdmRecord;

export type CompanyDocumentDto = {
  id: string;
  companyId: string;
  type: string;
  name?: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  uploadedAt?: string;
  expiryDate?: string;
  notes?: string;
  category?: string;
  status?: string;
  fileUrl?: string;
  uploadedBy?: string;
};

export type ApiKeyDto = {
  id: string;
  companyId: string;
  name: string;
  prefix: string;
  keyPrefix?: string;
  active?: boolean;
  createdAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
};

export type ApiKeyCreatedDto = ApiKeyDto & {
  apiKey?: string;
  key?: string;
};

export type SecurityPolicyDto = {
  companyId: string;
  mfaRequired?: boolean;
  requireMfa?: boolean;
  sessionDays?: number;
  passwordMinLength?: number;
  passwordHistoryCount?: number;
  idleTimeoutMinutes?: number;
  inviteTtlDays?: number;
  lockoutThreshold?: number;
  lockoutMinutes?: number;
  passwordComplexity?: boolean;
};

export type NotificationRuleDto = {
  id: string;
  companyId: string;
  event: string;
  channel: string;
  active: boolean;
  template?: string;
  label?: string;
  description?: string;
};

/** Driver-service record (tenant DB). */
export type DriverRecordDto = {
  id: string;
  companyId: string;
  userId?: string | null;
  name: string;
  email: string;
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
  availabilityStatus?: string;
  ownerOperatorProfile?: Record<string, unknown>;
};

export type EquipmentAssignmentDto = {
  id: string;
  driverId: string;
  assetId?: string;
  assetType?: string;
  unitNo?: string;
  assignmentType: string;
  role?: string;
  assignedAt?: string;
  unassignedAt?: string | null;
};

export type SafetyEventDto = {
  id: string;
  driverId: string;
  type: string;
  occurredAt: string;
  description?: string;
  severity?: string;
};

export type TrainingRecordDto = {
  id: string;
  driverId: string;
  courseCode: string;
  courseName?: string;
  completedAt?: string;
  expiryDate?: string;
  notes?: string;
};

export type EmploymentContractDto = {
  id: string;
  driverId: string;
  companyId: string;
  data?: Record<string, unknown>;
  payload?: { deductions?: string; notes?: string };
  type?: string;
  startDate?: string;
  payType?: string;
  payRate?: string;
  payUnit?: string;
  teamRate?: string;
  detentionRate?: string;
  waitRate?: string;
  fuelSurcharge?: string;
  vacationPct?: string;
  trialDays?: string;
  noticeDays?: string;
  benefits?: string;
  deductions?: string;
  notes?: string;
  signedByDriver?: boolean;
  signedByAdmin?: boolean;
  driverSignedAt?: string;
  employerSignedAt?: string;
  signedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  driverName?: string;
  companyName?: string;
};

export type InviteDetailDto = Invite & {
  company?: PlatformCompany;
  companyName?: string;
  role?: string;
  email?: string;
  name?: string;
  kind?: 'driver' | 'staff';
  expiresAt?: string;
  passwordPolicy?: { minLength?: number; hint?: string };
};

export type MaintenanceRecordDto = {
  id: string;
  companyId: string;
  assetId: string;
  type: string;
  scheduledAt?: string;
  completedAt?: string;
  performedAt?: string;
  nextDueAt?: string;
  vendor?: string;
  odometer?: number;
  cost?: number;
  vendorId?: string;
  notes?: string;
  title?: string;
  unitNo?: string;
};

export type DvirRecordDto = {
  id: string;
  companyId: string;
  assetId: string;
  driverId?: string;
  driverName?: string;
  unitNo?: string;
  status?: string;
  inspectedAt: string;
  defects?: string;
  signed?: boolean;
};

export type InvoiceDto = {
  id: string;
  companyId: string;
  number?: string;
  status: string;
  total?: number;
  currency?: string;
  dueDate?: string;
  customerId?: string;
  lines?: Array<{ label: string; amount: number }>;
  customerName?: string;
  amountPaid?: number;
};

export type BillDto = {
  id: string;
  companyId: string;
  vendorId?: string;
  vendorName?: string;
  status: string;
  total?: number;
  dueDate?: string;
};

export type PaymentDto = {
  id: string;
  companyId: string;
  amount: number;
  currency?: string;
  paidAt?: string;
  method?: string;
  direction?: string;
  partyName?: string;
};

export type AccountDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: string;
  active?: boolean;
};

export type MessageDto = {
  id: string;
  companyId: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  fromName?: string;
  toName?: string;
  threadType?: string;
};

export type CommentDto = {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  userId: string;
  body: string;
  createdAt: string;
  userName?: string;
};

export type AuditEntryDto = {
  id: string;
  companyId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

export type ReportAnalyticsDto = Record<string, unknown> & {
  companyId: string;
  generatedAt?: string;
};

/** Re-export domain models used as API payloads. */
export type {
  Asset,
  Load,
  CarrierProfile,
  TripSheet,
  DriverDocument,
  Settlement,
  Invite,
  Manifest,
  CompanyReportSummary,
};
