export const ASSET_TYPES = ['truck', 'trailer', 'equipment'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * Chapter 5 MDM Phase 1 — operational asset statuses (client §5.7 / §5.8).
 * Legacy `active` / `inactive` are normalized at the API boundary.
 */
export const ASSET_STATUSES = [
  'available',
  'assigned',
  'maintenance',
  'out_of_service',
  'retired',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Legacy values still accepted on write; mapped via normalizeAssetStatus. */
export const LEGACY_ASSET_STATUSES = ['active', 'inactive'] as const;

export const ASSET_STATUS_INPUT = [
  ...ASSET_STATUSES,
  ...LEGACY_ASSET_STATUSES,
] as const;

export type AssetStatusInput = (typeof ASSET_STATUS_INPUT)[number];

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

export function isAssetStatus(v: unknown): v is AssetStatus {
  return (
    typeof v === 'string' &&
    (ASSET_STATUSES as readonly string[]).includes(normalizeAssetStatus(v))
  );
}

/** Statuses that may be selected for a *new* dispatch assignment. */
export const ASSIGNABLE_ASSET_STATUSES: readonly AssetStatus[] = [
  'available',
  'assigned', // already on a load; reassignment rules enforced elsewhere
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

/** Client §5.11 equipment catalog defaults (company-seeded). */
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
