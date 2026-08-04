export const ASSET_TYPES = ['truck', 'trailer', 'equipment'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ['active', 'inactive'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
