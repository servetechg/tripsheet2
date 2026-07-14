import type { Company, User, Asset, Load, CarrierProfile } from '@tripsheet/shared';

export type SeedUser = User & { password: string };

export const SEED_COMPANIES: Company[] = [
  { id: 'c1', name: 'MKX Transport', shortName: 'MKX', address: '9 Red Sky Rd NE, Calgary, AB T3N 1P8', tagline: 'MORE EFFICIENT', active: true },
];

export const SEED_USERS: SeedUser[] = [
  { id: 'u1', name: 'Super Admin', role: 'superadmin', email: 'admin@tripsheet.io', password: 'admin123', companyId: null },
  { id: 'u2', name: 'MKX Admin', role: 'company_admin', email: 'admin@mkx.ca', password: 'mkx123', companyId: 'c1' },
  { id: 'u3', name: 'Divyam Chopra', role: 'driver', email: 'divyam@mkx.ca', password: 'driver123', companyId: 'c1' },
];

export const SEED_ASSETS: Asset[] = [
  { id: 'a1', companyId: 'c1', type: 'truck', unitNo: '32054', year: '2022', make: 'Kenworth', model: 'T680', vin: '1XKWDB0X0NJ123456', plate: 'AB-32054', status: 'active' },
  { id: 'a2', companyId: 'c1', type: 'truck', unitNo: '32055', year: '2021', make: 'Peterbilt', model: '579', vin: '1XPWDB9X0ND654321', plate: 'AB-32055', status: 'active' },
  { id: 'a3', companyId: 'c1', type: 'trailer', unitNo: 'DV1767', year: '2020', make: 'Stoughton', model: '53ft Dry Van', vin: '1DW1A5324LA000001', plate: 'AB-DV1767', status: 'active' },
  { id: 'a4', companyId: 'c1', type: 'trailer', unitNo: 'MKX002', year: '2019', make: 'Wabash', model: '53ft Reefer', vin: '1JJV532B8KL000002', plate: 'AB-MKX002', status: 'active' },
];

export const SEED_LOADS: Load[] = [
  { id: 'L001', companyId: 'c1', driverId: 'u3', truckId: 'a1', trailerId: 'a3', status: 'in_transit', origin: 'Calgary, AB', destination: 'Saint-Eustache, QC', pickupTime: 'May 20 08:00', eta: 'May 22 18:00', lat: 51.2, lng: -108.5, tripNo: '34320', lastUpdate: '2 min ago', speed: 95, heading: 'E', truckNo: '32054', trailerNo: 'DV1767' },
];

export const SEED_CARRIER_PROFILES: CarrierProfile[] = [
  { companyId: 'c1', cbsaCarrierCode: 'MKX1', scacCode: 'MKXT', dotNumber: '12345678', csnNumber: '', fastLane: false },
];
