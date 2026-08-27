/**
 * MDM Phase 3 — merge helpers (suggest is Phase 2; merge is explicit).
 */

export type MdmMergeEntity =
  | 'Broker'
  | 'Customer'
  | 'Consignee'
  | 'Carrier'
  | 'Location';

export const MDM_MERGE_ENTITIES: MdmMergeEntity[] = [
  'Broker',
  'Customer',
  'Consignee',
  'Carrier',
  'Location',
];

export function isMdmMergeEntity(v: string): v is MdmMergeEntity {
  return (MDM_MERGE_ENTITIES as string[]).includes(v);
}

/** Prefer survivor values; fill blanks from absorb. */
export function mergePartyFields(
  survivor: Record<string, unknown>,
  absorb: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const next = { ...survivor };
  for (const f of fields) {
    const s = next[f];
    const a = absorb[f];
    const blank =
      s == null ||
      s === '' ||
      (typeof s === 'string' && !String(s).trim());
    if (blank && a != null && String(a).trim() !== '') {
      next[f] = a;
    }
  }
  return next;
}

export function fleetFkColumnForEntity(
  entity: MdmMergeEntity,
): { column: string; nameColumn?: string } | null {
  switch (entity) {
    case 'Broker':
      return { column: 'brokerId', nameColumn: 'brokerName' };
    case 'Customer':
      return { column: 'customerId' };
    case 'Carrier':
      return { column: 'carrierId', nameColumn: 'carrierName' };
    default:
      return null;
  }
}
