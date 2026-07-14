import { DRIVER_DOC_TYPES as SHARED, DISPATCH_REQUIRED_DOCS, PAY_TYPES as SHARED_PAY } from '@tripsheet/shared';
import type { DriverDocTypeId, PayTypeId } from '@tripsheet/shared';

const DOC_ICONS: Record<DriverDocTypeId, string> = {
  contract: '📄',
  license: '🪪',
  abstract: '📋',
  medical: '🏥',
  fast_card: '🛂',
  twic: '🔐',
  hazmat: '☢️',
  cvor: '🚛',
  criminal: '✅',
  sin_ssn: '🔒',
  void_cheque: '🏦',
  other: '📎',
};

export const DRIVER_DOC_TYPES = SHARED.map((d) => ({
  ...d,
  icon: DOC_ICONS[d.id],
}));

export { DISPATCH_REQUIRED_DOCS };

const PAY_ICONS: Record<PayTypeId, string> = {
  per_mile: '🛣️',
  hourly: '⏱️',
  per_load: '📦',
  percentage: '📊',
  salary: '💰',
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
