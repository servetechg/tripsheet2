/**
 * Chapter 5 MDM Phase 6 — thin ops / finance reference helpers.
 */

import { normalizeKeyPart } from './party-status';

export const OPS_NAMED_TABLES = [
  'MaintenanceVendor',
  'FuelStation',
  'InsuranceProvider',
] as const;
export type OpsNamedTable = (typeof OPS_NAMED_TABLES)[number];

export const OPS_CODED_TABLES = ['CostCenter', 'PayrollCategory'] as const;
export type OpsCodedTable = (typeof OPS_CODED_TABLES)[number];

export function isOpsNamedTable(v: string): v is OpsNamedTable {
  return (OPS_NAMED_TABLES as readonly string[]).includes(v);
}

export function isOpsCodedTable(v: string): v is OpsCodedTable {
  return (OPS_CODED_TABLES as readonly string[]).includes(v);
}

export function buildOpsNormalizedKey(name: string): string {
  return normalizeKeyPart(name);
}

export function slugOpsCode(code: string): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '_')
    .slice(0, 32);
}

export const DEFAULT_COST_CENTERS: Array<{ code: string; name: string }> = [
  { code: 'OPS', name: 'Operations' },
  { code: 'FLEET', name: 'Fleet' },
  { code: 'ADMIN', name: 'Administration' },
];

export const DEFAULT_PAYROLL_CATEGORIES: Array<{
  code: string;
  name: string;
}> = [
  { code: 'MILEAGE', name: 'Mileage' },
  { code: 'HOURLY', name: 'Hourly' },
  { code: 'DETENTION', name: 'Detention' },
  { code: 'LAYOVER', name: 'Layover' },
];

export const DEFAULT_EXPENSE_CATEGORIES: Array<{
  code: string;
  name: string;
}> = [
  { code: 'FUEL', name: 'Fuel' },
  { code: 'LUMPER', name: 'Lumper' },
  { code: 'TOLL', name: 'Toll' },
  { code: 'PARKING', name: 'Parking' },
  { code: 'REPAIR', name: 'Repair' },
  { code: 'FOOD', name: 'Food' },
  { code: 'OTHER', name: 'Other' },
];

export const REF_KIND_EXPENSE = 'expense_category';
