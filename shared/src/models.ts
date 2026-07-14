import type { Role } from './roles';
import type { LoadStatus } from './load-status';
import type { ManifestStatus, ManifestType } from './manifest-status';
import type { AssetType, AssetStatus } from './asset-types';
import type { DocStatus, DriverDocTypeId } from './driver-doc-types';
import { CONTRACT_DOC_TYPE } from './driver-doc-types';
import type { PayTypeId } from './pay-types';
import type { InviteStatus } from './invite-status';

export interface Company {
  id: string;
  name: string;
  shortName: string;
  address: string;
  tagline: string;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  companyId: string | null;
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
  truckNo?: string;
}

export interface Asset {
  id: string;
  companyId: string;
  type: AssetType;
  unitNo: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  plate: string;
  status: AssetStatus;
}

export interface Load {
  id: string;
  companyId: string;
  driverId: string;
  truckId?: string;
  trailerId?: string;
  status: LoadStatus;
  origin: string;
  destination: string;
  pickupTime?: string;
  eta?: string;
  lat?: number;
  lng?: number;
  tripNo?: string;
  lastUpdate?: string;
  speed?: number;
  heading?: string;
  truckNo?: string;
  trailerNo?: string;
  notes?: string;
}

export interface CarrierProfile {
  companyId: string;
  cbsaCarrierCode: string;
  scacCode: string;
  dotNumber: string;
  csnNumber?: string;
  fastLane: boolean;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  companyId: string;
  type: DriverDocTypeId | typeof CONTRACT_DOC_TYPE;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string;
  uploadedAt: string;
  expiryDate?: string;
  notes?: string;
  status: DocStatus | 'uploaded';
}

export interface Invite {
  id: string;
  token: string;
  companyId: string;
  status: InviteStatus;
  createdAt: string;
  completedAt?: string;
  driverId?: string;
}

export interface TripLeg {
  id: string;
  tripNo: string;
  trailerNo: string;
  pickupDate: string;
  dropDate: string;
  from: string;
  to: string;
  notes: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  receiptNo: string;
  amount: string;
  currency: string;
}

export interface TripSheet {
  id: string;
  companyId: string;
  driverId: string;
  header: {
    truckNo: string;
    startDate: string;
    endDate: string;
    driver1: string;
    driver2: string;
  };
  trips: TripLeg[];
  expenses: Expense[];
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractData {
  startDate: string;
  payType: PayTypeId;
  payRate: string;
  payUnit: string;
  teamRate?: string;
  detentionRate?: string;
  waitRate?: string;
  fuelSurcharge?: string;
  vacationPct?: string;
  trialDays?: string;
  noticeDays?: string;
  benefits?: string;
  signedByDriver?: boolean;
  signedAt?: string;
  driverSignature?: string;
}

export interface AuthUser extends User {
  // never expose password to clients
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export type { ManifestStatus, ManifestType };
