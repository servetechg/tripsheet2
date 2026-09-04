/** Structured driver qualifications (Chapter 6 §6.8) */
export const QUALIFICATION_TYPES = [
  'license',
  'medical',
  'passport',
  'fast',
  'hazmat',
  'work_permit',
  'visa',
  'tanker',
  'air_brake',
  'doubles_triples',
] as const;

export type QualificationType = (typeof QUALIFICATION_TYPES)[number];

export const QUALIFICATION_TYPE_LABELS: Record<QualificationType, string> = {
  license: 'Driver Licence',
  medical: 'Medical Certificate',
  passport: 'Passport',
  fast: 'FAST Card',
  hazmat: 'Hazmat',
  work_permit: 'Work Permit',
  visa: 'Visa',
  tanker: 'Tanker',
  air_brake: 'Air Brake',
  doubles_triples: 'Doubles/Triples',
};

export const QUALIFICATION_STATUSES = [
  'valid',
  'expiring_soon',
  'expired',
  'missing',
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

/** Map document type ids → qualification type */
export const DOC_TO_QUALIFICATION: Record<string, QualificationType> = {
  license: 'license',
  medical: 'medical',
  fast_card: 'fast',
  hazmat: 'hazmat',
  border_doc: 'work_permit',
  permit: 'work_permit',
};

export const DISPATCH_REQUIRED_QUALIFICATIONS: readonly QualificationType[] = [
  'license',
  'medical',
];

/** Days before expiry to flag expiring_soon */
export const QUALIFICATION_EXPIRY_WARN_DAYS = 30;

export function computeQualificationStatus(
  expiryDate: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): QualificationStatus {
  if (!expiryDate?.trim()) return 'valid';
  if (expiryDate < today) return 'expired';
  const warn = new Date(today);
  warn.setDate(warn.getDate() + QUALIFICATION_EXPIRY_WARN_DAYS);
  if (expiryDate <= warn.toISOString().slice(0, 10)) return 'expiring_soon';
  return 'valid';
}
