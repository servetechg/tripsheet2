/**
 * Fleet assignment eligibility (Chapter 5 MDM Phase 1).
 * Kept in fleet-service so Nest does not depend on the shared package build path.
 * Mirror of shared/src/asset-types.ts helpers — keep in sync.
 */
export const ASSET_STATUSES = [
  'available',
  'assigned',
  'maintenance',
  'out_of_service',
  'retired',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_INPUT = [
  ...ASSET_STATUSES,
  'active',
  'inactive',
] as const;

export function normalizeAssetStatus(
  status: string | null | undefined,
): AssetStatus {
  const s = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'active' || s === '') return 'available';
  if (s === 'inactive') return 'retired';
  if (s === 'oos' || s === 'out_of_service') return 'out_of_service';
  if ((ASSET_STATUSES as readonly string[]).includes(s)) {
    return s as AssetStatus;
  }
  return 'available';
}

export const ASSIGNABLE_ASSET_STATUSES: readonly AssetStatus[] = [
  'available',
  'assigned',
];

export function canAssignAssetStatus(
  status: string | null | undefined,
): boolean {
  return ASSIGNABLE_ASSET_STATUSES.includes(normalizeAssetStatus(status));
}

export function assetAssignmentBlockReason(
  status: string | null | undefined,
  unitNo?: string,
): string {
  const n = normalizeAssetStatus(status);
  const label = unitNo ? `Unit ${unitNo}` : 'Asset';
  switch (n) {
    case 'out_of_service':
      return `${label} is Out of Service and cannot be assigned`;
    case 'maintenance':
      return `${label} is in Maintenance and cannot be assigned`;
    case 'retired':
      return `${label} is Retired and cannot be assigned`;
    default:
      return `${label} status "${n}" cannot be assigned`;
  }
}

export const DEFAULT_EQUIPMENT_TYPES = [
  { code: 'dry_van', name: 'Dry Van' },
  { code: 'reefer', name: 'Reefer' },
  { code: 'flatbed', name: 'Flatbed' },
  { code: 'step_deck', name: 'Step Deck' },
  { code: 'double_drop', name: 'Double Drop' },
  { code: 'rgn', name: 'RGN' },
  { code: 'power_only', name: 'Power Only' },
  { code: 'container', name: 'Container' },
  { code: 'tanker', name: 'Tanker' },
  { code: 'hopper', name: 'Hopper' },
  { code: 'car_hauler', name: 'Car Hauler' },
] as const;
