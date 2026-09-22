/** Company-scoped human-readable identifiers (per tenant). */

export const SEQUENCE_PREFIX = {
  truckUnit: 'TRK',
  trailerUnit: 'TRL',
  equipmentUnit: 'EQP',
  employee: 'EMP',
  loadTrip: 'TRP',
  sheetLeg: 'TSL',
} as const;

export function assetUnitPrefix(
  type: 'truck' | 'trailer' | 'equipment' | string,
): string {
  if (type === 'trailer') return SEQUENCE_PREFIX.trailerUnit;
  if (type === 'equipment') return SEQUENCE_PREFIX.equipmentUnit;
  return SEQUENCE_PREFIX.truckUnit;
}

export function formatCompanySequence(
  prefix: string,
  sequence: number,
  width = 6,
): string {
  return `${prefix}-${String(sequence).padStart(width, '0')}`;
}

/** Highest numeric suffix for values like `TRK-000042`. */
export function maxSequenceFromValues(
  values: Iterable<string | null | undefined>,
  prefix: string,
): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  for (const raw of values) {
    if (!raw) continue;
    const m = String(raw).trim().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export function nextSequenceFromValues(
  values: Iterable<string | null | undefined>,
  prefix: string,
): string {
  return formatCompanySequence(prefix, maxSequenceFromValues(values, prefix) + 1);
}
