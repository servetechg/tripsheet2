export const MANIFEST_STATUSES = [
  'draft',
  'submitted',
  'accepted',
  'rejected',
  'cancelled',
] as const;
export type ManifestStatus = (typeof MANIFEST_STATUSES)[number];

export const MANIFEST_STATUS_LABELS: Record<ManifestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const MANIFEST_TYPES = ['ACI', 'ACE'] as const;
export type ManifestType = (typeof MANIFEST_TYPES)[number];
