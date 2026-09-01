/** Real-time driver availability (Chapter 6 §6.10) */
export const DRIVER_AVAILABILITY_STATUSES = [
  'available',
  'unavailable',
  'on_dispatch',
  'off_duty',
  'vacation',
  'medical_leave',
  'training',
  'maintenance_delay',
] as const;

export type DriverAvailabilityStatus =
  (typeof DRIVER_AVAILABILITY_STATUSES)[number];

export const AVAILABILITY_LABELS: Record<DriverAvailabilityStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  on_dispatch: 'On Dispatch',
  off_duty: 'Off Duty',
  vacation: 'Vacation',
  medical_leave: 'Medical Leave',
  training: 'Training',
  maintenance_delay: 'Maintenance Delay',
};

/** Statuses that block new dispatch assignment by default */
export const AVAILABILITY_BLOCKS_DISPATCH: readonly DriverAvailabilityStatus[] = [
  'unavailable',
  'off_duty',
  'vacation',
  'medical_leave',
  'training',
  'maintenance_delay',
];

export function availabilityAllowsDispatch(
  status: DriverAvailabilityStatus | string | null | undefined,
): boolean {
  if (!status || status === 'available') return true;
  if (status === 'on_dispatch') return false;
  return !AVAILABILITY_BLOCKS_DISPATCH.includes(
    status as DriverAvailabilityStatus,
  );
}
