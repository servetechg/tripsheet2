export const DRIVER_DOC_TYPES = [
  { id: 'contract', label: 'Employment Contract', required: true },
  { id: 'license', label: "Driver's License", required: true },
  { id: 'abstract', label: "Driver's Abstract", required: true },
  { id: 'medical', label: 'Medical Certificate', required: true },
  { id: 'fast_card', label: 'FAST Card', required: false },
  { id: 'twic', label: 'TWIC Card (US)', required: false },
  { id: 'hazmat', label: 'HazMat Certificate', required: false },
  { id: 'cvor', label: 'CVOR Abstract', required: false },
  { id: 'criminal', label: 'Criminal Background Chk', required: false },
  { id: 'sin_ssn', label: 'SIN / SSN', required: true },
  { id: 'void_cheque', label: 'Void Cheque / Banking', required: false },
  { id: 'other', label: 'Other Document', required: false },
] as const;

export type DriverDocTypeId = (typeof DRIVER_DOC_TYPES)[number]['id'];

/** Docs required before a driver can be dispatched */
export const DISPATCH_REQUIRED_DOCS: readonly DriverDocTypeId[] = [
  'license',
  'abstract',
  'medical',
];

export const DOC_STATUSES = [
  'uploaded',
  'expired',
  'expiring_soon',
  'missing',
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/** Special type used for signed employment contracts stored with docs */
export const CONTRACT_DOC_TYPE = '__contract__' as const;
