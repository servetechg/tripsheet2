import type { Dispatch, SetStateAction, CSSProperties, ReactNode } from 'react';
import type {
  Company,
  Asset,
  Load,
  CarrierProfile,
  TripSheet,
  DriverDocument,
  Invite,
  LoadStatus,
} from '@tripsheet/shared';

export type Setter<T> = Dispatch<SetStateAction<T>>;

export type NavTab = { id: string; icon: string; label: string };

export type ManifestShipment = {
  id?: string;
  ccn?: string;
  description?: string;
  weight?: string;
  pieces?: string;
  [key: string]: unknown;
};

export type Manifest = {
  id: string;
  companyId: string;
  type: 'ACI' | 'ACE';
  status: string;
  crn?: string;
  loadId?: string;
  driverId?: string;
  truckId?: string;
  trailerId?: string;
  portOfEntry?: string;
  estimatedArrival?: string;
  shipments?: ManifestShipment[];
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  [key: string]: unknown;
};

export type FileUploadData = {
  name: string;
  size: number;
  fileType: string;
  data: string;
  expiry?: string;
  notes?: string;
};

export type DocTypeMeta = {
  id: string;
  label: string;
  required: boolean;
  icon?: string;
};

export type ContractForm = {
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
  signedByDriver?: boolean;
  signedByAdmin?: boolean;
  signedAt?: string;
  driverSignature?: string;
  adminSignature?: string;
  [key: string]: unknown;
};

export type StyleProps = { style?: CSSProperties; children?: ReactNode };

export type {
  Company,
  Asset,
  Load,
  CarrierProfile,
  TripSheet,
  DriverDocument,
  Invite,
  LoadStatus,
};
