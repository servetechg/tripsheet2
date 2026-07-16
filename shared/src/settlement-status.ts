export const SETTLEMENT_STATUSES = ['draft', 'approved', 'paid'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];
