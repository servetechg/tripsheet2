import type { Dispatch, SetStateAction } from 'react';
import type { Asset, DriverDocument, Load } from '@tripsheet/shared';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { TripCountry } from '@/lib/dispatchLocations';

export type DispatchLoadFormState = {
  driverId: string;
  truckId: string;
  trailerId: string;
  brokerId: string;
  carrierId: string;
  commodityId: string;
  crossBorder: boolean;
  portOfEntryId: string;
  customsProgram: string;
  customsAce: boolean;
  customsAci: boolean;
  customsPaps: boolean;
  customsPars: boolean;
  portOfEntryCode: string;
  portOfEntryName: string;
  originLocationId: string;
  destinationLocationId: string;
  originCountry: TripCountry | '';
  destinationCountry: TripCountry | '';
  origin: string;
  destination: string;
  pickupTime: string;
  eta: string;
  tripNo: string;
  notes: string;
  customerRate: string;
  carrierCost: string;
  fuelSurcharge: string;
  accessorials: string;
  detentionHours: string;
  detentionRate: string;
  miles: string;
  intermediateStops: string[];
};

export type DispatchTabProps = {
  company: PlatformCompany;
  loads: Load[];
  setLoads: Dispatch<SetStateAction<Load[]>>;
  drivers: AppUser[];
  trucks: Asset[];
  trailers: Asset[];
  users: AppUser[];
  statusColor: (status: string) => string;
  onTrack: () => void;
  onEManifest: () => void;
  driverDocs?: DriverDocument[];
  apiEnabled: boolean;
  refreshAll: (
    companyId?: string | null,
    scope?: 'full' | 'driver',
  ) => Promise<void>;
};
