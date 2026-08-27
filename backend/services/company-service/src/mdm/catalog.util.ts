/**
 * Chapter 5 MDM Phase 4 — catalog helpers.
 */

import { canSelectPartyStatus, normalizeKeyPart } from './party-status';

export function buildCommodityNormalizedKey(name: string): string {
  return normalizeKeyPart(name);
}

export function buildWarehouseNormalizedKey(name: string): string {
  return normalizeKeyPart(name);
}

export function canSelectCatalogStatus(
  status: string | null | undefined,
): boolean {
  return canSelectPartyStatus(status);
}

export const DEFAULT_COMMODITIES: Array<{
  code: string;
  name: string;
  hazmat: boolean;
  nmfc?: string;
}> = [
  { code: 'general', name: 'General Freight', hazmat: false },
  { code: 'auto_parts', name: 'Auto Parts', hazmat: false },
  { code: 'produce', name: 'Produce', hazmat: false },
  { code: 'frozen', name: 'Frozen Food', hazmat: false },
  { code: 'dry_goods', name: 'Dry Goods', hazmat: false },
  { code: 'steel', name: 'Steel / Metal', hazmat: false },
  { code: 'lumber', name: 'Lumber', hazmat: false },
  { code: 'hazmat', name: 'Hazmat (regulated)', hazmat: true },
];
