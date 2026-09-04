/** Frontend mirror of MDM Phase 1 asset status helpers. */
export const ASSET_STATUSES = [
  'available',
  'assigned',
  'maintenance',
  'out_of_service',
  'retired',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

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

export function canAssignAsset(status: string | null | undefined): boolean {
  const n = normalizeAssetStatus(status);
  return n === 'available' || n === 'assigned';
}

export function assetStatusLabel(status: string | null | undefined): string {
  return normalizeAssetStatus(status).replace(/_/g, ' ').toUpperCase();
}
