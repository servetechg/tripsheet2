/** Driver employment types (Chapter 6 §6.4) */
export const DRIVER_TYPES = [
  'company',
  'owner_operator',
  'team',
  'relief',
  'temporary',
  'seasonal',
] as const;

export type DriverType = (typeof DRIVER_TYPES)[number];

export const DRIVER_TYPE_LABELS: Record<DriverType, string> = {
  company: 'Company Driver',
  owner_operator: 'Owner-Operator',
  team: 'Team Driver',
  relief: 'Relief Driver',
  temporary: 'Temporary',
  seasonal: 'Seasonal',
};

export const EMPLOYMENT_STATUSES = [
  'active',
  'leave',
  'vacation',
  'suspended',
  'terminated',
  'retired',
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: 'Active',
  leave: 'Leave',
  vacation: 'Vacation',
  suspended: 'Suspended',
  terminated: 'Terminated',
  retired: 'Retired',
};

export type OwnerOperatorProfile = {
  corporationName?: string;
  gstHstNumber?: string;
  w9W8?: string;
  insuranceNotes?: string;
  settlementTerms?: string;
};
