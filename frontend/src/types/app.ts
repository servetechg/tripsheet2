import type {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  CSSProperties,
  ReactNode,
} from 'react';
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

export type FieldChangeEvent = ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

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
  displaySize?: string;
};

export type DocTypeMeta = {
  id: string;
  label: string;
  required: boolean;
  icon?: string;
};

export type ContractForm = {
  id?: string;
  driverId?: string;
  companyId?: string;
  driverName?: string;
  companyName?: string;
  createdAt?: string;
  updatedAt?: string;
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
  signedAt?: string;
  driverSignature?: string;
  adminSignature?: string;
};

/** API loads may include audit timestamps not on the shared Load model. */
export type LoadWithTimestamps = Load & {
  createdAt?: string;
  updatedAt?: string;
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
