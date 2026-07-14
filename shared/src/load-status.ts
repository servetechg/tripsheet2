export const LOAD_STATUSES = [
  'assigned',
  'in_transit',
  'delivered',
  'cancelled',
] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  assigned: 'Assigned',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Allowed transitions: from → to[] */
export const LOAD_STATUS_TRANSITIONS: Record<LoadStatus, readonly LoadStatus[]> = {
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransitionLoad(from: LoadStatus, to: LoadStatus): boolean {
  return LOAD_STATUS_TRANSITIONS[from].includes(to);
}
