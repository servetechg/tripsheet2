import { DRIVER_DOC_TYPES as SHARED, DISPATCH_REQUIRED_DOCS, PAY_TYPES as SHARED_PAY } from '@tripsheet/shared';
import type { DriverDocTypeId, PayTypeId } from '@tripsheet/shared';

/** Monochrome icon keys mapped to `Icons` (no emoji). */
const DOC_ICONS: Record<DriverDocTypeId, string> = {
  contract: 'contract',
  license: 'docs',
  abstract: 'sheets',
  medical: 'docs',
  fast_card: 'assigned',
  twic: 'docs',
  hazmat: 'alert',
  cvor: 'truck',
  criminal: 'completed',
  sin_ssn: 'docs',
  void_cheque: 'expenses',
  other: 'docs',
};

export const DRIVER_DOC_TYPES = SHARED.map((d) => ({
  ...d,
  icon: DOC_ICONS[d.id],
}));

export { DISPATCH_REQUIRED_DOCS };

const PAY_ICONS: Record<PayTypeId, string> = {
  per_mile: 'track',
  hourly: 'pending',
  per_load: 'box',
  percentage: 'chart',
  salary: 'revenue',
};

export const PAY_TYPES = SHARED_PAY.map((p) => ({
  ...p,
  icon: PAY_ICONS[p.id],
}));

export const DOC_STATUS_COLOR: Record<string, string> = {
  uploaded: '#2f9e58',
  expired: '#e53e3e',
  expiring_soon: '#D4A017',
  missing: '#666',
};
