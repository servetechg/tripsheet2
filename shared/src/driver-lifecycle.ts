/** Driver lifecycle statuses (Chapter 6 §6.3) */
export const DRIVER_LIFECYCLE_STATUSES = [
  'invited',
  'pending_review',
  'approved',
  'active',
  'on_leave',
  'vacation',
  'suspended',
  'terminated',
  'archived',
] as const;

export type DriverLifecycleStatus =
  (typeof DRIVER_LIFECYCLE_STATUSES)[number];

export const DRIVER_LIFECYCLE_LABELS: Record<DriverLifecycleStatus, string> = {
  invited: 'Invited',
  pending_review: 'Pending HR Review',
  approved: 'Approved',
  active: 'Active',
  on_leave: 'On Leave',
  vacation: 'Vacation',
  suspended: 'Suspended',
  terminated: 'Terminated',
  archived: 'Archived',
};

export function lifecycleBlocksLogin(
  status: DriverLifecycleStatus | string | undefined | null,
): boolean {
  return (
    status === 'suspended' ||
    status === 'terminated' ||
    status === 'archived'
  );
}

export function lifecycleAllowsDispatch(
  status: DriverLifecycleStatus | string | undefined | null,
): boolean {
  return status === 'active';
}

/** Sync legacy `active` boolean from lifecycle status */
export function syncActiveFromLifecycle(
  status: DriverLifecycleStatus | string,
): boolean {
  return (
    status === 'active' ||
    status === 'approved' ||
    status === 'on_leave' ||
    status === 'vacation'
  );
}

export function authStatusForLifecycle(
  status: DriverLifecycleStatus,
): 'active' | 'suspended' | 'inactive' | 'archived' {
  if (status === 'suspended') return 'suspended';
  if (status === 'terminated') return 'inactive';
  if (status === 'archived') return 'archived';
  return 'active';
}
